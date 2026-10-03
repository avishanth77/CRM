from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.leads.models import Lead, LeadProductInterest, LeadTouch, LeadProblem, LeadSource, Campaign
from apps.leads.serializers import (
    LeadSerializer, LeadProductInterestSerializer,
    LeadTouchSerializer, LeadProblemSerializer,
    LeadSourceSerializer, CampaignSerializer
)
from apps.pld_engine.models import PipelineStage
from apps.pld_engine.services import GateValidator, ICPEvaluator
from apps.workflows.models import StageHistory
from apps.products.models import Product, Problem
from apps.accounts.models import Account, Contact


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().prefetch_related(
        'product_interests__product', 'recorded_problems__problem', 'touches__source'
    ).select_related('account', 'contact', 'primary_product', 'current_stage', 'owner')
    serializer_class = LeadSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        lead = serializer.save()

        # Automatic ICP Evaluation on Lead Creation
        if lead.account and lead.primary_product:
            config_version = lead.primary_product.configurations.filter(status='PUBLISHED').first()
            if config_version:
                try:
                    ICPEvaluator.evaluate(
                        account=lead.account,
                        product=lead.primary_product,
                        config_version=config_version,
                        lead=lead,
                        user=user
                    )
                except Exception:
                    pass

    @action(detail=False, methods=['post'], url_path='check-duplicates')
    def check_duplicates(self, request):
        company_name = request.data.get('company_name', '').strip()
        domain = request.data.get('domain', '').strip()
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()

        duplicates = []

        if domain:
            matched_accounts = Account.objects.filter(domain__iexact=domain)
            for acc in matched_accounts:
                duplicates.append({
                    'type': 'ACCOUNT',
                    'id': str(acc.id),
                    'name': acc.company_name,
                    'matched_on': f'Domain match: {domain}',
                    'confidence': 'HIGH'
                })

        if company_name:
            matched_accounts = Account.objects.filter(company_name__icontains=company_name)[:5]
            for acc in matched_accounts:
                if not any(d['id'] == str(acc.id) for d in duplicates):
                    duplicates.append({
                        'type': 'ACCOUNT',
                        'id': str(acc.id),
                        'name': acc.company_name,
                        'matched_on': f'Company name match: {acc.company_name}',
                        'confidence': 'MEDIUM'
                    })

        if email:
            matched_contacts = Contact.objects.filter(email__iexact=email).select_related('account')
            for c in matched_contacts:
                duplicates.append({
                    'type': 'CONTACT',
                    'id': str(c.id),
                    'name': f"{c.first_name} {c.last_name or ''} ({c.account.company_name})",
                    'matched_on': f'Email match: {email}',
                    'confidence': 'EXACT'
                })

        return Response({
            'has_duplicates': len(duplicates) > 0,
            'duplicate_count': len(duplicates),
            'duplicates': duplicates
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='transition-stage')
    def transition_stage(self, request, pk=None):
        lead = self.get_object()
        target_stage_id = request.data.get('target_stage_id')
        transition_reason = request.data.get('transition_reason', '')
        is_override = request.data.get('is_override', False)

        try:
            target_stage = PipelineStage.objects.get(id=target_stage_id)
        except PipelineStage.DoesNotExist:
            return Response({'error': 'Target stage not found'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce Gate Validation
        validation = GateValidator.validate_lead_stage(lead, target_stage)

        if not validation['all_passed'] and not is_override:
            return Response({
                'error': 'Gate criteria not satisfied for transition to ' + target_stage.stage_name,
                'checklist': validation['checklist']
            }, status=status.HTTP_400_BAD_REQUEST)

        # Record Stage History
        from_stage = lead.current_stage
        lead.current_stage = target_stage
        lead.save(update_fields=['current_stage'])

        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=from_stage,
            to_stage=target_stage,
            transition_reason=transition_reason,
            is_override=is_override,
            changed_by=request.user if request.user.is_authenticated else None
        )

        # If entering Discovery stage, auto-initialize Discovery workspace and carry forward problems
        if target_stage.stage_code == 'DISCOVERY' or 'Discovery' in target_stage.stage_name:
            from apps.discovery.models import Discovery
            from apps.discovery.services import DiscoveryService
            disc, _ = Discovery.objects.get_or_create(
                lead=lead,
                defaults={
                    'account': lead.account,
                    'product': lead.primary_product,
                    'conducted_by': request.user if request.user.is_authenticated else None,
                    'next_action_description': lead.next_action_description,
                    'next_activity_due_at': lead.next_activity_due_at
                }
            )
            DiscoveryService.carry_forward_lead_problems(disc)

        # If entering Demo stage, auto-initialize Demo workspace with Discovery use case mappings
        elif target_stage.stage_code == 'DEMO' or 'Demo' in target_stage.stage_name:
            from apps.evaluations.services import DemoService
            DemoService.create_or_init_demo(
                lead=lead,
                discovery=lead.discoveries.first(),
                user=request.user if request.user.is_authenticated else None
            )

        # If entering POC stage, auto-initialize POC trial with Discovery KPIs & criteria
        elif target_stage.stage_code == 'POC' or 'POC' in target_stage.stage_name:
            from apps.evaluations.services import POCService
            POCService.create_or_init_poc(
                lead=lead,
                discovery=lead.discoveries.first(),
                user=request.user if request.user.is_authenticated else None
            )

        return Response({
            'message': f"Lead successfully progressed to {target_stage.stage_name}",
            'lead': LeadSerializer(lead).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='problems')
    def problems(self, request, pk=None):
        lead = self.get_object()
        if request.method == 'GET':
            qs = lead.recorded_problems.all().select_related('problem')
            return Response(LeadProblemSerializer(qs, many=True).data)

        problem_id = request.data.get('problem_id')
        problem_code = request.data.get('problem_code')
        problem_name = request.data.get('problem_name')
        category = request.data.get('category', 'DISTRIBUTION')
        severity = request.data.get('severity', 'HIGH')
        frequency = request.data.get('frequency', 'DAILY')
        business_impact = request.data.get('business_impact', '')
        affected_users = request.data.get('affected_users', '')
        evidence = request.data.get('evidence', '')
        notes = request.data.get('notes', '')

        problem = None
        if problem_id:
            problem = Problem.objects.filter(id=problem_id).first()
        elif problem_code:
            problem = Problem.objects.filter(code=problem_code).first()
        elif problem_name:
            code = f"PROB_{problem_name.upper().replace(' ', '_')[:30]}"
            problem, _ = Problem.objects.get_or_create(
                code=code,
                defaults={
                    'name': problem_name,
                    'category': category,
                    'default_severity': severity
                }
            )

        if not problem:
            return Response({'error': 'Problem identification (problem_id, problem_code, or problem_name) is required'}, status=status.HTTP_400_BAD_REQUEST)

        lp, _ = LeadProblem.objects.update_or_create(
            lead=lead,
            problem=problem,
            defaults={
                'category': category,
                'severity': severity,
                'frequency': frequency,
                'business_impact': business_impact,
                'affected_users': affected_users,
                'evidence': evidence,
                'notes': notes
            }
        )
        return Response(LeadProblemSerializer(lp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-problem')
    def add_problem(self, request, pk=None):
        return self.problems(request, pk)

    @action(detail=True, methods=['post'], url_path='add-product-interest')
    def add_product_interest(self, request, pk=None):
        lead = self.get_object()
        product_id = request.data.get('product_id')
        interest_level = request.data.get('interest_level', 'HIGH')
        is_primary = request.data.get('is_primary', False)
        evidence_notes = request.data.get('evidence_notes', '')

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        lpi, _ = LeadProductInterest.objects.update_or_create(
            lead=lead,
            product=product,
            defaults={
                'interest_level': interest_level,
                'is_primary': is_primary,
                'evidence_notes': evidence_notes
            }
        )

        # Automatic ICP Evaluation when product interest is added/updated
        if lead.account:
            config_version = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
            if config_version:
                try:
                    ICPEvaluator.evaluate(
                        account=lead.account,
                        product=product,
                        config_version=config_version,
                        lead=lead,
                        user=request.user if request.user.is_authenticated else None
                    )
                except Exception:
                    pass

        return Response(LeadProductInterestSerializer(lpi).data, status=status.HTTP_201_CREATED)


class LeadSourceViewSet(viewsets.ModelViewSet):
    queryset = LeadSource.objects.all()
    serializer_class = LeadSourceSerializer
    permission_classes = [permissions.AllowAny]


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.AllowAny]


class LeadTouchViewSet(viewsets.ModelViewSet):
    queryset = LeadTouch.objects.all()
    serializer_class = LeadTouchSerializer
    permission_classes = [permissions.AllowAny]
