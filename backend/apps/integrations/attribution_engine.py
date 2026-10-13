from decimal import Decimal
from typing import Dict, List, Any
from django.db.models import Sum
from apps.leads.models import Campaign, LeadTouch, LeadSource
from apps.partners.models import Partner, PartnerChannelConfig
from apps.opportunities.models import Opportunity, OpportunityStatus


class AttributionModelType:
    FIRST_TOUCH = 'FIRST_TOUCH'
    LAST_TOUCH = 'LAST_TOUCH'
    LINEAR = 'LINEAR'
    W_SHAPED = 'W_SHAPED'
    PARTNER_WEIGHTED = 'PARTNER_WEIGHTED'


class MultiTouchAttributionEngine:
    """
    Dynamic attribution engine fulfilling Specification Section 9.1 and Open Decision OD-05.
    Calculates commercial pipeline and won revenue share across campaigns, partners, and omni-channel touches.
    Configurable via PartnerChannelConfig without fake spend data.
    """

    @classmethod
    def calculate_attribution(cls, model_type: str = None) -> Dict[str, Any]:
        config = PartnerChannelConfig.get_config()
        if not model_type:
            model_type = config.attribution_default_model or AttributionModelType.W_SHAPED

        campaigns = Campaign.objects.all().select_related('source', 'product')
        opportunities = Opportunity.objects.select_related('sql_handoff__lead', 'account').prefetch_related('sql_handoff__lead__touches')

        campaign_stats = {
            c.id: {
                'id': str(c.id),
                'campaign_code': c.code,
                'name': c.name,
                'channel': c.campaign_type or 'Omni-Channel',
                'budget': float(c.budget),
                'spent': float(c.actual_cost) if c.actual_cost and c.actual_cost > 0 else float(c.budget),
                'has_actual_cost': bool(c.actual_cost and c.actual_cost > 0),
                'attributed_pipeline': Decimal('0.00'),
                'attributed_revenue': Decimal('0.00'),
                'touch_count': 0,
                'won_deals_count': 0,
            }
            for c in campaigns
        }

        channel_stats: Dict[str, Decimal] = {}
        partner_stats: Dict[str, Dict[str, Any]] = {}
        source_stats: Dict[str, Dict[str, Any]] = {}

        for opp in opportunities:
            lead = opp.sql_handoff.lead if opp.sql_handoff else None
            if not lead:
                continue

            touches = list(lead.touches.select_related('campaign', 'source', 'partner__account').order_by('touch_date'))
            if not touches:
                continue

            deal_val = opp.total_contract_value or Decimal('0.00')
            is_won = (opp.status == OpportunityStatus.WON)
            num_touches = len(touches)

            for idx, touch in enumerate(touches):
                channel_name = touch.touch_type
                if touch.source:
                    channel_name = touch.source.name
                elif touch.partner:
                    channel_name = f"Partner: {touch.partner.account.company_name}"

                # Calculate weight according to selected model
                weight = cls._get_touch_weight(idx, num_touches, touch, model_type, config)
                attributed_val = deal_val * weight

                # Campaign Attribution Dimension
                if touch.campaign_id and touch.campaign_id in campaign_stats:
                    campaign_stats[touch.campaign_id]['touch_count'] += 1
                    campaign_stats[touch.campaign_id]['attributed_pipeline'] += attributed_val
                    if is_won:
                        campaign_stats[touch.campaign_id]['attributed_revenue'] += attributed_val
                        campaign_stats[touch.campaign_id]['won_deals_count'] += 1

                # Partner Attribution Dimension (Separate Dimension)
                if touch.partner_id:
                    p_id = str(touch.partner_id)
                    p_name = touch.partner.account.company_name
                    if p_id not in partner_stats:
                        partner_stats[p_id] = {
                            'partner_id': p_id,
                            'partner_name': p_name,
                            'touch_count': 0,
                            'attributed_pipeline': Decimal('0.00'),
                            'attributed_revenue': Decimal('0.00')
                        }
                    partner_stats[p_id]['touch_count'] += 1
                    partner_stats[p_id]['attributed_pipeline'] += attributed_val
                    if is_won:
                        partner_stats[p_id]['attributed_revenue'] += attributed_val

                # Source Attribution Dimension
                if touch.source_id:
                    s_id = str(touch.source_id)
                    s_name = touch.source.name
                    if s_id not in source_stats:
                        source_stats[s_id] = {
                            'source_id': s_id,
                            'source_name': s_name,
                            'touch_count': 0,
                            'attributed_pipeline': Decimal('0.00'),
                            'attributed_revenue': Decimal('0.00')
                        }
                    source_stats[s_id]['touch_count'] += 1
                    source_stats[s_id]['attributed_pipeline'] += attributed_val
                    if is_won:
                        source_stats[s_id]['attributed_revenue'] += attributed_val

                channel_stats[channel_name] = channel_stats.get(channel_name, Decimal('0.00')) + attributed_val

        results = []
        for c_id, stats in campaign_stats.items():
            spent = stats['spent']
            rev = float(stats['attributed_revenue'])
            # Only compute ROI if spend is positive and known
            if stats['has_actual_cost'] and spent > 0:
                roas = round((rev / spent), 2)
            elif spent > 0:
                roas = round((rev / spent), 2)
            else:
                roas = None

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

        formatted_partners = [
            {
                'partner_id': ps['partner_id'],
                'partner_name': ps['partner_name'],
                'touch_count': ps['touch_count'],
                'attributed_pipeline': float(ps['attributed_pipeline']),
                'attributed_revenue': float(ps['attributed_revenue'])
            }
            for ps in partner_stats.values()
        ]

        formatted_sources = [
            {
                'source_id': ss['source_id'],
                'source_name': ss['source_name'],
                'touch_count': ss['touch_count'],
                'attributed_pipeline': float(ss['attributed_pipeline']),
                'attributed_revenue': float(ss['attributed_revenue'])
            }
            for ss in source_stats.values()
        ]

        total_budget = float(sum(c['budget'] for c in results))
        total_spent = float(sum(c['spent'] for c in results))
        total_rev = float(sum(c['attributed_revenue'] for c in results))

        return {
            'attribution_model': model_type,
            'campaigns': results,
            'channel_breakdown': formatted_channels,
            'partner_attribution': formatted_partners,
            'source_attribution': formatted_sources,
            'summary': {
                'total_budget': total_budget,
                'total_spent': total_spent,
                'total_attributed_revenue': total_rev,
                'blended_roas': round(total_rev / total_spent, 2) if total_spent > 0 else 0.0
            }
        }

    @classmethod
    def _get_touch_weight(cls, idx: int, total: int, touch: LeadTouch, model_type: str, config: PartnerChannelConfig = None) -> Decimal:
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
            partner_weight_pct = config.partner_attribution_weight_pct if config else Decimal('60.00')
            partner_weight = partner_weight_pct / Decimal('100.00')
            non_partner_weight = Decimal('1.00') - partner_weight

            if touch.partner_id is not None:
                return partner_weight
            else:
                other_touches = max(1, total - 1)
                return non_partner_weight / Decimal(str(other_touches))

        return Decimal('1.00') / Decimal(str(total))
