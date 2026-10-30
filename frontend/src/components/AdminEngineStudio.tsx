import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldCheck, Scale, FileText, Plus, Edit2, 
  RefreshCw, Sliders, Trash2, X, Building2
} from 'lucide-react';
import { api } from '../services/api';
import type { 
  Product, ICPProfile, ICPRule, ScoreModel, 
  QuestionnaireTemplate, QuestionnaireQuestion, QuestionAnswerOption
} from '../services/api';
import { inAppAlert } from './common/InAppAlert';
import { AddProductModal } from './common/AddProductModal';
import { AddIndustryModal } from './common/AddIndustryModal';
import { EditProductModal } from './common/EditProductModal';

interface AdminEngineStudioProps {
  products: Product[];
  onProductCreated?: (product: Product) => void;
  onProductUpdated?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
}

export const AdminEngineStudio: React.FC<AdminEngineStudioProps> = ({ 
  products, 
  onProductCreated, 
  onProductUpdated, 
  onProductDeleted 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'icp' | 'scoring' | 'questionnaires'>('icp');
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]?.id || '');
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showEditProductModal, setShowEditProductModal] = useState<boolean>(false);
  const [showAddIndustryModal, setShowAddIndustryModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<ICPProfile[]>([]);
  const [rules, setRules] = useState<ICPRule[]>([]);
  const [scoreModels, setScoreModels] = useState<ScoreModel[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Configurable ICP Pass Threshold state
  const [editingProfileThreshold, setEditingProfileThreshold] = useState<{ [profileId: string]: number }>({});
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);

  const handleSaveThreshold = async (profileId: string) => {
    const newThreshold = editingProfileThreshold[profileId];
    if (newThreshold === undefined || isNaN(newThreshold) || newThreshold < 0 || newThreshold > 100) {
      notify('error', 'Please enter a valid threshold between 0% and 100%.');
      return;
    }
    setSavingProfileId(profileId);
    try {
      const updated = await api.saveICPProfile({ id: profileId, pass_threshold: newThreshold });
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, pass_threshold: updated.pass_threshold ?? newThreshold } : p));
      notify('success', `Pass threshold updated to ${newThreshold}% successfully.`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to update threshold.');
    } finally {
      setSavingProfileId(null);
    }
  };

  // Edit / Create Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ICPRule>>({
    rule_type: 'KNOCKOUT',
    field_name: '',
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

  // Edit / Create Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuestionnaireQuestion> | null>(null);

  // Edit / Create Option Modal
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [targetQuestionForOption, setTargetQuestionForOption] = useState<QuestionnaireQuestion | null>(null);
  const [editingOption, setEditingOption] = useState<Partial<QuestionAnswerOption> | null>(null);
  const [productQuestionnaire, setProductQuestionnaire] = useState<QuestionnaireTemplate | null>(null);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireTemplate[]>([]);

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
    inAppAlert.show(type, text);
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
      setQuestionnaires(Array.isArray(qData) ? qData : (qData?.results || []));

      if (selectedProduct) {
        try {
          const specificQ = await api.getQuestionnaireForProduct(selectedProduct);
          setProductQuestionnaire(specificQ);
        } catch {
          setProductQuestionnaire(null);
        }
      }
    } catch (e: any) {
      console.error('Failed to load admin configs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profiles[0]) {
      notify('error', 'No active ICP Profile found for this product. Create a profile first.');
      return;
    }

    try {
      let parsedTargetValue: any = editingRule.target_value;
      const op = editingRule.operator === 'EXACT' ? 'EQ' : (editingRule.operator || 'EQ');
      if (['IN', 'NOT_IN'].includes(op) && typeof parsedTargetValue === 'string') {
        parsedTargetValue = parsedTargetValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (['GTE', 'LTE', 'GT', 'LT'].includes(op) && !isNaN(Number(parsedTargetValue)) && parsedTargetValue !== '') {
        parsedTargetValue = Number(parsedTargetValue);
      } else if (parsedTargetValue === 'true' || parsedTargetValue === 'True') {
        parsedTargetValue = true;
      } else if (parsedTargetValue === 'false' || parsedTargetValue === 'False') {
        parsedTargetValue = false;
      }

      const targetProfile = profiles.find(p => p.id === editingRule.profile) || profiles[0];
      const cv = (targetProfile as any)?.config_version;
      const cvId = typeof cv === 'object' && cv !== null ? cv.id : (cv || (targetProfile as any)?.config_version_id || undefined);
      const payload: any = {
        ...editingRule,
        rule_type: editingRule.rule_type === 'FIT_CRITERIA' ? 'FIT' : editingRule.rule_type,
        operator: op,
        target_value: parsedTargetValue,
        points: editingRule.weight || 10,
        weight: editingRule.weight || 10,
        profile: targetProfile?.id,
        config_version: cvId || undefined,
      };
      await api.saveICPRule(payload);
      notify('success', 'ICP Rule configuration updated successfully.');
      setShowRuleModal(false);
      loadEngineConfigs();
      window.dispatchEvent(new CustomEvent('icp-rules-updated', { detail: { productId: selectedProduct } }));
    } catch (err: any) {
      notify('error', err.message || 'Failed to save ICP rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this ICP qualification rule?')) return;
    try {
      await api.deleteICPRule(ruleId);
      notify('success', 'ICP Rule deleted successfully.');
      loadEngineConfigs();
      window.dispatchEvent(new CustomEvent('icp-rules-updated', { detail: { productId: selectedProduct } }));
    } catch (err: any) {
      notify('error', err.message || 'Failed to delete ICP rule');
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
      notify('error', err.message || 'Failed to save score model');
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !activeTemplate) return;
    try {
      const payload: Partial<QuestionnaireQuestion> = {
        ...editingQuestion,
        template: activeTemplate.id,
      };
      await api.saveQuestionnaireQuestion(payload);
      notify('success', editingQuestion.id ? 'Question updated successfully.' : 'Question created successfully.');
      setShowQuestionModal(false);
      loadEngineConfigs();
    } catch (err: any) {
      notify('error', err.message || 'Failed to save question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this qualification question and all its options?')) return;
    try {
      await api.deleteQuestionnaireQuestion(questionId);
      notify('success', 'Question deleted successfully.');
      loadEngineConfigs();
    } catch (err: any) {
      notify('error', err.message || 'Failed to delete question');
    }
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption || !targetQuestionForOption) return;
    try {
      const payload: Partial<QuestionAnswerOption> = {
        ...editingOption,
        question: targetQuestionForOption.id,
        value: editingOption.value || editingOption.label,
        points: Number(editingOption.points ?? editingOption.score_value ?? 50)
      };
      await api.saveQuestionAnswerOption(payload);
      notify('success', editingOption.id ? 'Answer option updated.' : 'Answer option added successfully.');
      setShowOptionModal(false);
      loadEngineConfigs();
    } catch (err: any) {
      notify('error', err.message || 'Failed to save option');
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    if (!confirm('Are you sure you want to delete this answer option?')) return;
    try {
      await api.deleteQuestionOption(optionId);
      notify('success', 'Answer option deleted.');
      loadEngineConfigs();
    } catch (err: any) {
      notify('error', err.message || 'Failed to delete option');
    }
  };

  const activeTemplate = productQuestionnaire || (questionnaires || []).find(q => q.product === selectedProduct) || questionnaires?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER & PRODUCT SELECTOR */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            ICP &amp; PLD Engine Administration Studio
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Requirement 17: Configurable profiles, knock-out rules, score models, thresholds, and dynamic questionnaires.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Product:</span>
            <select
              className="form-select"
              value={selectedProduct}
              onChange={e => {
                if (e.target.value === '__NEW__') {
                  setShowAddProductModal(true);
                } else {
                  setSelectedProduct(e.target.value);
                }
              }}
              style={{ minWidth: '180px' }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
              <option value="__NEW__">+ Add New Product...</option>
            </select>

            {products.find(p => p.id === selectedProduct) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowEditProductModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '6px 10px' }}
                title="Edit active product settings"
              >
                <Edit2 size={13} />
                <span>Edit Product</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddProductModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
            title="Create a new commercial solution product"
          >
            <Plus size={14} />
            <span>Add Product</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowAddIndustryModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
            title="Create a new master industry sector"
          >
            <Building2 size={14} />
            <span>Add Industry</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={loadEngineConfigs}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onProductCreated={(newProd) => {
          onProductCreated?.(newProd);
          setSelectedProduct(newProd.id);
          notify('success', `Product "${newProd.name}" created and set as active.`);
        }}
      />

      <EditProductModal
        isOpen={showEditProductModal}
        product={products.find(p => p.id === selectedProduct) || null}
        onClose={() => setShowEditProductModal(false)}
        onProductUpdated={(updatedProd) => {
          onProductUpdated?.(updatedProd);
          notify('success', `Product "${updatedProd.name}" updated successfully.`);
        }}
        onProductDeleted={(deletedId) => {
          onProductDeleted?.(deletedId);
          notify('success', 'Product deleted successfully.');
          const remaining = products.filter(p => p.id !== deletedId);
          setSelectedProduct(remaining[0]?.id || '');
        }}
      />

      <AddIndustryModal
        isOpen={showAddIndustryModal}
        onClose={() => setShowAddIndustryModal(false)}
        onIndustryCreated={(newInd) => {
          notify('success', `Industry "${newInd.name}" created successfully.`);
        }}
      />

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
                  field_name: '',
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
              <div key={prof.id} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{prof.name}</span>
                    <span className="badge badge-info">Ver {prof.version_number}</span>
                    <span className="badge badge-neutral">{rules.length} Rules Attached</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {prof.description}
                  </div>
                </div>

                {/* Configurable Passing Fit Threshold */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-primary)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Passing ICP Fit Threshold:
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Leads with Fit Score below this percentage fail ICP (Default: 50%)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProfileThreshold[prof.id] ?? (prof.pass_threshold ?? 50)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingProfileThreshold(prev => ({ ...prev, [prof.id]: Math.min(Math.max(val, 0), 100) }));
                      }}
                      style={{
                        width: '60px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>%</span>
                    {(editingProfileThreshold[prof.id] !== undefined && editingProfileThreshold[prof.id] !== (prof.pass_threshold ?? 50)) && (
                      <button
                        className="btn btn-primary"
                        disabled={savingProfileId === prof.id}
                        onClick={() => handleSaveThreshold(prof.id)}
                        style={{ padding: '4px 12px', fontSize: '0.74rem', borderRadius: '6px' }}
                      >
                        {savingProfileId === prof.id ? 'Saving...' : 'Save Threshold'}
                      </button>
                    )}
                  </div>
                </div>
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
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${rule.rule_type === 'KNOCKOUT' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.68rem' }}>
                        {rule.rule_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
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
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Delete Rule"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
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
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{model.name}</h4>
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
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</div>
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
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{(activeTemplate as any).name || (activeTemplate as any).title}</span>
                    <span className="badge badge-info">Version {activeTemplate.version_number}</span>
                    <span className="badge badge-neutral">Stage: {activeTemplate.stage_code}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Template Code: {(activeTemplate as any).code || 'PLD_QUALIFICATION'} • Total Questions: {activeTemplate.questions?.length || 0}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingQuestion({
                      question_text: '',
                      code: `Q${(activeTemplate.questions?.length || 0) + 1}_CUSTOM`,
                      question_type: 'CHOICE',
                      feeds_dimension: 'TECHNICAL_FIT',
                      dimension_weight_points: 10,
                      order: (activeTemplate.questions?.length || 0) + 1,
                      is_required: true,
                      help_text: ''
                    });
                    setShowQuestionModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                >
                  <Plus size={14} />
                  Add New Question
                </button>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTemplate.questions?.map((q, idx) => (
                  <div key={q.id || idx} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>Q{idx + 1}.</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{q.question_text}</span>
                          {q.is_required && <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Required</span>}
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>Type: {q.question_type}</span>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Feeds: {q.feeds_dimension}</span>
                        </div>
                        {q.help_text && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {q.help_text}
                          </div>
                        )}
                      </div>

                      {/* Question Admin Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setTargetQuestionForOption(q);
                            setEditingOption({
                              label: '',
                              value: '',
                              points: 50,
                              order: (q.options?.length || 0) + 1,
                              is_active: true
                            });
                            setShowOptionModal(true);
                          }}
                          style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Add new answer option to this question"
                        >
                          <Plus size={12} />
                          Add Option
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionModal(true);
                          }}
                          style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                          title="Edit question details"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleDeleteQuestion(q.id)}
                          style={{ fontSize: '0.72rem', padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          title="Delete question"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Answer Options */}
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                        Configured Options ({q.options?.length || 0}):
                      </div>
                      {q.options && q.options.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {q.options.map(opt => (
                            <div
                              key={opt.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '0.75rem'
                              }}
                            >
                              <span>{opt.label}</span>
                              <strong style={{ color: 'var(--primary)', fontSize: '0.72rem' }}>
                                (+{opt.points ?? opt.score_value ?? 0}pts)
                              </strong>
                              {opt.knockout_flag && <span style={{ color: 'var(--danger)', fontSize: '0.65rem' }}>[KO]</span>}
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetQuestionForOption(q);
                                  setEditingOption(opt);
                                  setShowOptionModal(true);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                                title="Edit this option"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(opt.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--danger)' }}
                                title="Delete this option"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No choices added yet. Click &quot;+ Add Option&quot; above to configure choices.
                        </div>
                      )}
                    </div>
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
      {showRuleModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '100%', maxWidth: '540px', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header-accent" />
            <div className="modal-card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Configure ICP Rule
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Set criteria for knockout qualification and fit score weighting
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRuleModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: '1 1 auto' }}>
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
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: EDIT SCORE MODEL */}
      {showModelModal && editingModel && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '100%', maxWidth: '600px', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header-accent" />
            <div className="modal-card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <Scale size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Edit PLD Score Weights &amp; Thresholds
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Tune dimension scoring distributions and readiness classification bands
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModelModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: '1 1 auto' }}>
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
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Weights &amp; Thresholds</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: ADD / EDIT QUESTIONNAIRE QUESTION */}
      {showQuestionModal && editingQuestion && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '100%', maxWidth: '620px', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header-accent" />
            <div className="modal-card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  <FileText size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {editingQuestion.id ? 'Edit Qualification Question' : 'Add New Qualification Question'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Configure qualification questions, evaluation dimensions, and rep guidance
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowQuestionModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: '1 1 auto' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Question Text *
                  </label>
                  <textarea
                    required
                    rows={2}
                    className="form-input"
                    value={editingQuestion.question_text || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                    placeholder="e.g. How are customer sales orders currently captured in the field?"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Question Code *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={editingQuestion.code || ''}
                      onChange={e => setEditingQuestion({ ...editingQuestion, code: e.target.value })}
                      placeholder="e.g. Q16_FIELD_ORDERING"
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Question Type
                    </label>
                    <select
                      className="form-select"
                      value={editingQuestion.question_type || 'CHOICE'}
                      onChange={e => setEditingQuestion({ ...editingQuestion, question_type: e.target.value })}
                      style={{ width: '100%', marginTop: '4px' }}
                    >
                      <option value="CHOICE">CHOICE (Select Option)</option>
                      <option value="BOOLEAN">BOOLEAN (Yes / No Options)</option>
                      <option value="TEXT">TEXT (Free Text Input)</option>
                      <option value="NUMERIC">NUMERIC (Number Input)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Feeds Scoring Dimension
                    </label>
                    <select
                      className="form-select"
                      value={editingQuestion.feeds_dimension || 'TECHNICAL_FIT'}
                      onChange={e => setEditingQuestion({ ...editingQuestion, feeds_dimension: e.target.value })}
                      style={{ width: '100%', marginTop: '4px' }}
                    >
                      <option value="TECHNICAL_FIT">Technical Fit</option>
                      <option value="COMMERCIAL_POTENTIAL">Commercial Potential</option>
                      <option value="PROBLEM_SEVERITY">Problem Severity</option>
                      <option value="BUSINESS_VALUE">Business Value</option>
                      <option value="DECISION_ACCESS">Decision Access</option>
                      <option value="TIMELINE">Timeline</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Display Order &amp; Sequence
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={editingQuestion.order || 1}
                      onChange={e => setEditingQuestion({ ...editingQuestion, order: parseInt(e.target.value) || 1 })}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Help / Guidance Text for Sales Rep
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingQuestion.help_text || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, help_text: e.target.value })}
                    placeholder="e.g. Ask if they use pen & paper, mobile invoicing, or a dedicated tablet app"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="chk_req"
                    checked={editingQuestion.is_required !== false}
                    onChange={e => setEditingQuestion({ ...editingQuestion, is_required: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="chk_req" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Mandatory Question (Required for Qualification)
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuestionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingQuestion.id ? 'Save Changes' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: ADD / EDIT QUESTION ANSWER OPTION */}
      {showOptionModal && editingOption && targetQuestionForOption && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '100%', maxWidth: '520px', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header-accent" />
            <div className="modal-card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  <Sliders size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {editingOption.id ? 'Edit Answer Option' : 'Add Option to Question'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Assign point values and qualification scoring weight
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowOptionModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOption} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: '1 1 auto' }}>
                <div style={{ padding: '8px 12px', background: 'var(--bg-surface-elevated)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>Question:</strong> {targetQuestionForOption.question_text}
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Option Label (Displayed to Rep) *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editingOption.label || ''}
                    onChange={e => setEditingOption({ ...editingOption, label: e.target.value, value: editingOption.value || e.target.value })}
                    placeholder="e.g. Cloud Hybrid Route App"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Option Stored Value
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingOption.value || ''}
                      onChange={e => setEditingOption({ ...editingOption, value: e.target.value })}
                      placeholder="e.g. cloud_hybrid"
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Score Points (0 - 100) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      className="form-input"
                      value={editingOption.points ?? editingOption.score_value ?? 50}
                      onChange={e => setEditingOption({ ...editingOption, points: parseInt(e.target.value) || 0, score_value: parseInt(e.target.value) || 0 })}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={editingOption.order || 1}
                    onChange={e => setEditingOption({ ...editingOption, order: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOptionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingOption.id ? 'Save Option' : 'Add Option'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
