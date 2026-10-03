import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Scale, FileText, Plus, Edit2, 
  RefreshCw, Sliders 
} from 'lucide-react';
import { api } from '../services/api';
import type { 
  Product, ICPProfile, ICPRule, ScoreModel, 
  QuestionnaireTemplate 
} from '../services/api';

interface AdminEngineStudioProps {
  products: Product[];
}

export const AdminEngineStudio: React.FC<AdminEngineStudioProps> = ({ products }) => {
  const [activeSubTab, setActiveSubTab] = useState<'icp' | 'scoring' | 'questionnaires'>('icp');
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]?.id || '');
  const [loading, setLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<ICPProfile[]>([]);
  const [rules, setRules] = useState<ICPRule[]>([]);
  const [scoreModels, setScoreModels] = useState<ScoreModel[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireTemplate[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit / Create Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ICPRule>>({
    rule_type: 'KNOCKOUT',
    field_name: 'industry',
    operator: 'EXACT',
    target_value: '',
    weight: 0,
    is_active: true,
    failure_reason: '',
    description: '',
  });

  // Edit Score Model Weights Modal
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ScoreModel | null>(null);

  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0].id);
    }
  }, [products]);

  useEffect(() => {
    loadEngineConfigs();
  }, [selectedProduct]);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4500);
  };

  const loadEngineConfigs = async () => {
    setLoading(true);
    try {
      const [profData, rData, smData, qData] = await Promise.all([
        api.getICPProfiles(selectedProduct).catch(() => []),
        api.getICPRules(selectedProduct).catch(() => []),
        api.getScoreModels(selectedProduct).catch(() => []),
        api.getQuestionnaires().catch(() => ({ results: [] })),
      ]);
      setProfiles(profData);
      setRules(rData);
      setScoreModels(smData);
      setQuestionnaires(qData.results || []);
    } catch (e: any) {
      console.error('Failed to load admin configs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profiles[0]) {
      alert('No active ICP Profile found for this product. Create a profile first.');
      return;
    }

    try {
      const payload: Partial<ICPRule> = {
        ...editingRule,
        profile: editingRule.profile || profiles[0].id,
      };
      await api.saveICPRule(payload);
      notify('success', 'ICP Rule configuration updated successfully.');
      setShowRuleModal(false);
      loadEngineConfigs();
    } catch (err: any) {
      alert(err.message || 'Failed to save ICP rule');
    }
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;

    try {
      await api.saveScoreModel(editingModel);
      notify('success', 'PLD Score Model weights & thresholds updated successfully.');
      setShowModelModal(false);
      loadEngineConfigs();
    } catch (err: any) {
      alert(err.message || 'Failed to save score model');
    }
  };

  const activeTemplate = questionnaires.find(q => q.product === selectedProduct) || questionnaires[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER & PRODUCT SELECTOR */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
            ICP &amp; PLD Engine Administration Studio
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Requirement 17: Configurable profiles, knock-out rules, score models, thresholds, and dynamic questionnaires.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Product:</span>
            <select
              className="form-select"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary"
            onClick={loadEngineConfigs}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: statusMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${statusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: statusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          fontSize: '0.85rem'
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* SUB TABS */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setActiveSubTab('icp')}
          className={`btn ${activeSubTab === 'icp' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.82rem' }}
        >
          <ShieldCheck size={15} />
          ICP Profiles &amp; Knock-Out Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveSubTab('scoring')}
          className={`btn ${activeSubTab === 'scoring' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.82rem' }}
        >
          <Scale size={15} />
          Deterministic PLD Score Models ({scoreModels.length})
        </button>
        <button
          onClick={() => setActiveSubTab('questionnaires')}
          className={`btn ${activeSubTab === 'questionnaires' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.82rem' }}
        >
          <FileText size={15} />
          Dynamic Qualification Questionnaires ({activeTemplate?.questions?.length || 0})
        </button>
      </div>

      {/* SUBTAB 1: ICP PROFILES & RULES */}
      {activeSubTab === 'icp' && (
        <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Product ICP Profile &amp; Rules</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Knock-out rules evaluate first (PASS/FAIL). Fit criteria compute the 0-100 fit score.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingRule({
                  rule_type: 'KNOCKOUT',
                  field_name: 'industry',
                  operator: 'EXACT',
                  target_value: '',
                  weight: 0,
                  is_active: true,
                  failure_reason: '',
                  description: '',
                  profile: profiles[0]?.id || '',
                });
                setShowRuleModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} /> Add Configurable Rule
            </button>
          </div>

          {/* Active Profile Summary */}
          {profiles.length > 0 ? (
            profiles.map(prof => (
              <div key={prof.id} style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{prof.name}</span>
                    <span className="badge badge-info">Ver {prof.version_number}</span>
                    <span className="badge badge-success">Pass Threshold: {prof.pass_threshold}%</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {prof.description}
                  </div>
                </div>
                <span className="badge badge-neutral">{rules.length} Rules Attached</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--warning)', fontSize: '0.8rem' }}>
              No ICP Profile configured for this product yet.
            </div>
          )}

          {/* Rules Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Type</th>
                  <th style={{ padding: '10px 8px' }}>Field Evaluated</th>
                  <th style={{ padding: '10px 8px' }}>Operator</th>
                  <th style={{ padding: '10px 8px' }}>Target / Threshold</th>
                  <th style={{ padding: '10px 8px' }}>Weight</th>
                  <th style={{ padding: '10px 8px' }}>Failure Reason / Description</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${rule.rule_type === 'KNOCKOUT' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.68rem' }}>
                        {rule.rule_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#FFFFFF' }}>
                      {rule.field_name}
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {rule.operator}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {rule.target_value}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 700 }}>
                      {rule.rule_type === 'KNOCKOUT' ? 'KNOCKOUT' : `${rule.weight} pts`}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                      {rule.failure_reason || rule.description}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {rule.is_active ? (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Active</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Inactive</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => {
                          setEditingRule(rule);
                          setShowRuleModal(true);
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SCORE MODELS */}
      {activeSubTab === 'scoring' && (
        <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Deterministic PLD Score Models &amp; Thresholds</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Deterministic scoring formula. The backend computes dimension scores using configured weights and assigns outcome tiers.
            </p>
          </div>

          {scoreModels.map(model => (
            <div key={model.id} style={{ padding: '18px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>{model.name}</h4>
                  <span className="badge badge-info">Version {model.version_number}</span>
                  <span className="badge badge-success">Status: Published</span>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => {
                    setEditingModel(JSON.parse(JSON.stringify(model)));
                    setShowModelModal(true);
                  }}
                >
                  <Sliders size={14} /> Edit Weights &amp; Thresholds
                </button>
              </div>

              {/* Dimension Weights */}
              <div>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Configured Dimension Weights (Must Sum to 100%)
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                  {Object.entries(model.weights || {}).map(([dim, weight]) => (
                    <div key={dim} style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {dim.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                        {weight}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outcome Thresholds */}
              <div>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Configured Outcome Thresholds
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { key: 'NURTURE', label: 'Nurture', range: `0 - ${(model.thresholds?.DEVELOPMENT ?? 31) - 1}` },
                    { key: 'DEVELOPMENT', label: 'PLD Development', range: `${model.thresholds?.DEVELOPMENT ?? 31} - ${(model.thresholds?.QUALIFIED ?? 61) - 1}` },
                    { key: 'QUALIFIED', label: 'Qualified PLD', range: `${model.thresholds?.QUALIFIED ?? 61} - ${(model.thresholds?.HIGH_PRIORITY ?? 81) - 1}` },
                    { key: 'HIGH_PRIORITY', label: 'High Priority', range: `${model.thresholds?.HIGH_PRIORITY ?? 81} - 100` },
                  ].map(t => (
                    <div key={t.key} style={{ padding: '10px', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF' }}>{t.label}</div>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                        Score: {t.range}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBTAB 3: DYNAMIC QUESTIONNAIRES */}
      {activeSubTab === 'questionnaires' && (
        <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Qualification Questionnaire Templates &amp; Questions</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Configurable question catalog for VanForces and future products. Zero hard-coded questions.
            </p>
          </div>

          {activeTemplate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>{activeTemplate.name}</span>
                    <span className="badge badge-info">Version {activeTemplate.version_number}</span>
                    <span className="badge badge-neutral">Stage: {activeTemplate.stage_code}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Template Code: {activeTemplate.code} • Total Questions: {activeTemplate.questions?.length || 0}
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeTemplate.questions?.map((q, idx) => (
                  <div key={q.id} style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>Q{idx + 1}.</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>{q.question_text}</span>
                        {q.is_required && <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Required</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>Type: {q.question_type}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Feeds: {q.feeds_dimension}</span>
                      </div>
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {q.options.map(opt => (
                          <div key={opt.id} style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                            {opt.label} <strong style={{ color: 'var(--primary)' }}>({opt.score_value}pts)</strong>
                            {opt.knockout_flag && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>[KO]</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--warning)', fontSize: '0.8rem' }}>
              No questionnaire template configured for this product.
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT ICP RULE */}
      {showRuleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '24px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Configure ICP Rule</h3>
              <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => setShowRuleModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Rule Type</label>
                  <select
                    className="form-select"
                    value={editingRule.rule_type}
                    onChange={e => setEditingRule({ ...editingRule, rule_type: e.target.value as any })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="KNOCKOUT">KNOCKOUT (Pass/Fail Gate)</option>
                    <option value="FIT_CRITERIA">FIT_CRITERIA (Scoring Points)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Field to Evaluate</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editingRule.field_name}
                    onChange={e => setEditingRule({ ...editingRule, field_name: e.target.value })}
                    placeholder="e.g. industry, van_count"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Operator</label>
                  <select
                    className="form-select"
                    value={editingRule.operator}
                    onChange={e => setEditingRule({ ...editingRule, operator: e.target.value })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="EXACT">EXACT (=)</option>
                    <option value="IN">IN (List of values)</option>
                    <option value="NOT_IN">NOT IN</option>
                    <option value="GTE">GTE (&gt;=)</option>
                    <option value="LTE">LTE (&lt;=)</option>
                    <option value="GT">GT (&gt;)</option>
                    <option value="LT">LT (&lt;)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Target Value</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editingRule.target_value}
                    onChange={e => setEditingRule({ ...editingRule, target_value: e.target.value })}
                    placeholder="e.g. FMCG, 5"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              {editingRule.rule_type === 'FIT_CRITERIA' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Weight (Fit Points)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input"
                    value={editingRule.weight}
                    onChange={e => setEditingRule({ ...editingRule, weight: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Failure Reason (Explains Why ICP Failed)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={editingRule.failure_reason}
                  onChange={e => setEditingRule({ ...editingRule, failure_reason: e.target.value })}
                  placeholder="e.g. Account does not operate a direct-store-delivery van fleet"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowRuleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SCORE MODEL */}
      {showModelModal && editingModel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '24px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Edit PLD Score Weights &amp; Thresholds</h3>
              <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => setShowModelModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Dimension Weights (Percent)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {Object.entries(editingModel.weights || {}).map(([dim, val]) => (
                  <div key={dim}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {dim.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={val}
                      onChange={e => {
                        const newWeights = { ...editingModel.weights, [dim]: parseInt(e.target.value) || 0 };
                        setEditingModel({ ...editingModel, weights: newWeights });
                      }}
                      style={{ width: '100%', marginTop: '2px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '10px' }}>
                Outcome Thresholds (Minimum Score Required)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Development Min</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={editingModel.thresholds?.DEVELOPMENT ?? 31}
                    onChange={e => {
                      const newThresh = { ...editingModel.thresholds, DEVELOPMENT: parseInt(e.target.value) || 31 };
                      setEditingModel({ ...editingModel, thresholds: newThresh });
                    }}
                    style={{ width: '100%', marginTop: '2px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Qualified Min</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={editingModel.thresholds?.QUALIFIED ?? 61}
                    onChange={e => {
                      const newThresh = { ...editingModel.thresholds, QUALIFIED: parseInt(e.target.value) || 61 };
                      setEditingModel({ ...editingModel, thresholds: newThresh });
                    }}
                    style={{ width: '100%', marginTop: '2px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>High Priority Min</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={editingModel.thresholds?.HIGH_PRIORITY ?? 81}
                    onChange={e => {
                      const newThresh = { ...editingModel.thresholds, HIGH_PRIORITY: parseInt(e.target.value) || 81 };
                      setEditingModel({ ...editingModel, thresholds: newThresh });
                    }}
                    style={{ width: '100%', marginTop: '2px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Weights &amp; Thresholds</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
