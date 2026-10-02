from decimal import Decimal
from typing import Dict, List, Any
from django.db.models import Sum
from apps.leads.models import Campaign, LeadTouch
from apps.opportunities.models import Opportunity


class AttributionModelType:
    FIRST_TOUCH = 'FIRST_TOUCH'
    LAST_TOUCH = 'LAST_TOUCH'
    LINEAR = 'LINEAR'
    W_SHAPED = 'W_SHAPED'
    PARTNER_WEIGHTED = 'PARTNER_WEIGHTED'


class MultiTouchAttributionEngine:
    """
    Dynamic attribution engine fulfilling Specification Section 9.1 and Open Decision OD-05.
    Calculates commercial pipeline and won revenue share across campaigns and omni-channel touches.
    """

    @classmethod
    def calculate_attribution(cls, model_type: str = AttributionModelType.W_SHAPED) -> Dict[str, Any]:
        campaigns = Campaign.objects.all()
        opportunities = Opportunity.objects.select_related('sql_handoff__lead', 'account').prefetch_related('sql_handoff__lead__touches')

        campaign_stats = {
            c.id: {
                'id': str(c.id),
                'campaign_code': c.code,
                'name': c.name,
                'channel': c.campaign_type or 'Omni-Channel',
                'budget': float(c.budget),
                'spent': float(c.budget * Decimal('0.65')),  # Estimated spend
                'attributed_pipeline': Decimal('0.00'),
                'attributed_revenue': Decimal('0.00'),
                'touch_count': 0,
                'won_deals_count': 0,
            }
            for c in campaigns
        }

        channel_stats: Dict[str, Decimal] = {}

        for opp in opportunities:
            lead = opp.sql_handoff.lead if opp.sql_handoff else None
            if not lead:
                continue

            touches = list(lead.touches.select_related('campaign', 'source', 'partner').order_by('touch_date'))
            if not touches:
                continue

            deal_val = opp.total_contract_value or Decimal('0.00')
            is_won = (opp.status == 'WON')
            num_touches = len(touches)

            for idx, touch in enumerate(touches):
                channel_name = touch.touch_type
                if touch.source:
                    channel_name = touch.source.name
                elif touch.partner:
                    channel_name = f"Partner: {touch.partner.account.company_name}"

                # Calculate weight according to selected model
                weight = cls._get_touch_weight(idx, num_touches, touch, model_type)
                attributed_val = deal_val * weight

                if touch.campaign_id and touch.campaign_id in campaign_stats:
                    campaign_stats[touch.campaign_id]['touch_count'] += 1
                    campaign_stats[touch.campaign_id]['attributed_pipeline'] += attributed_val
                    if is_won:
                        campaign_stats[touch.campaign_id]['attributed_revenue'] += attributed_val
                        campaign_stats[touch.campaign_id]['won_deals_count'] += 1

                channel_stats[channel_name] = channel_stats.get(channel_name, Decimal('0.00')) + attributed_val

        results = []
        for c_id, stats in campaign_stats.items():
            spent = stats['spent']
            rev = float(stats['attributed_revenue'])
            roas = round((rev / spent), 2) if spent > 0 else (1.0 if rev > 0 else 0.0)
            results.append({
                **stats,
                'attributed_pipeline': float(stats['attributed_pipeline']),
                'attributed_revenue': rev,
                'roas': roas,
            })

        formatted_channels = [
            {'channel': ch, 'attributed_pipeline': float(val)}
            for ch, val in channel_stats.items()
        ]

        total_budget = float(sum(c['budget'] for c in results))
        total_spent = float(sum(c['spent'] for c in results))
        total_rev = float(sum(c['attributed_revenue'] for c in results))

        return {
            'attribution_model': model_type,
            'campaigns': results,
            'channel_breakdown': formatted_channels,
            'summary': {
                'total_budget': total_budget,
                'total_spent': total_spent,
                'total_attributed_revenue': total_rev,
                'blended_roas': round(total_rev / total_spent, 2) if total_spent > 0 else 0.0
            }
        }

    @classmethod
    def _get_touch_weight(cls, idx: int, total: int, touch: LeadTouch, model_type: str) -> Decimal:
        if total == 1:
            return Decimal('1.00')

        if model_type == AttributionModelType.FIRST_TOUCH:
            return Decimal('1.00') if idx == 0 else Decimal('0.00')

        elif model_type == AttributionModelType.LAST_TOUCH:
            return Decimal('1.00') if idx == (total - 1) else Decimal('0.00')

        elif model_type == AttributionModelType.LINEAR:
            return Decimal('1.00') / Decimal(str(total))

        elif model_type == AttributionModelType.W_SHAPED:
            if idx == 0:
                return Decimal('0.30')
            elif idx == (total - 1):
                return Decimal('0.30')
            elif idx == (total // 2):
                return Decimal('0.30')
            else:
                remaining_touches = max(1, total - 3)
                return Decimal('0.10') / Decimal(str(remaining_touches))

        elif model_type == AttributionModelType.PARTNER_WEIGHTED:
            if touch.partner_id is not None:
                return Decimal('0.60')
            else:
                other_touches = max(1, total - 1)
                return Decimal('0.40') / Decimal(str(other_touches))

        return Decimal('1.00') / Decimal(str(total))
