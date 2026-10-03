import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, 
  HelpCircle, Plus, FileText, 
  ArrowRight, RefreshCw, UserCheck, Scale, History, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import type { 
  Lead, AccountProductAssessment, QuestionnaireTemplate, 
  LeadProblemItem, StageGateChecklist 
} from '../services/api';

interface PLDQualificationWorkspaceProps {
  lead: Lead;
  onTransitionSuccess?: () => void;
  onLeadUpdated?: () => void;
}

export const PLDQualificationWorkspace: React.FC<PLDQualificationWorkspaceProps> = ({
  lead,
  onTransitionSuccess,
  onLeadUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AccountProductAssessment | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireTemplate | null>(null);
  const [problems, setProblems] = useState<LeadProblemItem[]>([]);
  const [gateChecklist, setGateChecklist] = useState<StageGateChecklist | null>(null);
  
  // Questionnaire form state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [savingScore, setSavingScore] = useState(false);
  const [evaluatingICP, setEvaluatingICP] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Score Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScore, setOverrideScore] = useState<number>(75);
  const [overrideClassification, setOverrideClassification] = useState<string>('QUALIFIED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Business Problem Modal state
  const [showAddProblemModal, setShowAddProblemModal] = useState(false);
  const [newProbName, setNewProbName] = useState('');
  const [newProbCategory, setNewProbCategory] = useState('DISTRIBUTION');
  const [newProbSeverity, setNewProbSeverity] = useState('HIGH');
  const [newProbFrequency, setNewProbFrequency] = useState('DAILY');
  const [newProbImpact, setNewProbImpact] = useState('');
  const [newProbUsers, setNewProbUsers] = useState('');
  const [newProbEvidence, setNewProbEvidence] = useState('');
  const [newProbNotes, setNewProbNotes] = useState('');
  const [savingProblem, setSavingProblem] = useState(false);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);

  // Active view toggle
  const [activeSection, setActiveSection] = useState<'icp' | 'questionnaire' | 'problems' | 'score' | 'history'>('questionnaire');

  useEffect(() => {
    loadWorkspaceData();
  }, [lead.id, lead.primary_product]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      // 1. Load Questionnaire for Lead's primary product
      let qTemplate: QuestionnaireTemplate | null = null;
      try {
        qTemplate = await api.getQuestionnaireForProduct(lead.primary_product);
        setQuestionnaire(qTemplate);
      } catch (err) {
        console.warn('No active questionnaire template found for product:', lead.primary_product, err);
      }

      // 2. Load Assessment for this Account + Product
      let currentAssessment: AccountProductAssessment | null = null;
      try {
        const assessments = await api.getAssessments({
          account: lead.account,
          product: lead.primary_product,
          lead: lead.id,
        });
        if (assessments && assessments.length > 0) {
          currentAssessment = assessments[0];
        } else {
          // If no assessment exists yet, evaluate ICP automatically
          const icpRes = await api.evaluateICP(lead.account, lead.primary_product, lead.id);
          if (icpRes && icpRes.assessment_id) {
            currentAssessment = await api.getAssessmentById(icpRes.assessment_id);
          }
        }
      } catch (err) {
        console.warn('Error fetching or initializing assessment:', err);
      }
      setAssessment(currentAssessment);

      // Pre-fill questionnaire answers if stored in assessment
      if (currentAssessment?.questionnaire_answers) {
        setAnswers(currentAssessment.questionnaire_answers);
      }

      // 3. Load Documented Business Problems for this Lead
      try {
        const probs = await api.getLeadProblems(lead.id);
        setProblems(probs);
      } catch (err) {
        console.warn('Error fetching lead problems:', err);
      }

      // 4. Validate Stage Gate readiness
      try {
        const configs = await api.getConfigurations();
        const currentConfig = configs.results?.find((c: any) => c.product === lead.primary_product) || configs.results?.[0];
        if (currentConfig?.stages) {
          const nextStage = currentConfig.stages.find((s: any) => s.sequence_order === 4) || currentConfig.stages[1];
          if (nextStage) {
            const check = await api.validateGate(lead.id, nextStage.id);
            setGateChecklist(check);
          }
        }
      } catch (err) {
        console.warn('Gate validation check error:', err);
      }

    } catch (e: any) {
      console.error('Failed to load PLD Workspace data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReEvaluateICP = async () => {
    setEvaluatingICP(true);
    try {
      const res = await api.evaluateICP(lead.account, lead.primary_product, lead.id);
      showNotification('success', `ICP Evaluated: ${res.result} (Fit Score: ${res.fit_score}/100)`);
      if (res.assessment_id) {
        const updated = await api.getAssessmentById(res.assessment_id);
        setAssessment(updated);
      }
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      showNotification('error', err.message || 'ICP evaluation failed.');
    } finally {
      setEvaluatingICP(false);
    }
  };

  const handleAnswerChange = (questionCode: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionCode]: value
    }));
  };

  const handleCalculateScore = async () => {
    if (!assessment) {
      showNotification('error', 'No assessment record found. Run ICP evaluation first.');
      return;
    }

    setSavingScore(true);
    try {
      const res = await api.evaluatePLDScore(assessment.id, answers);
      showNotification('success', `PLD Score Updated: ${res.total_score}/100 [${res.classification}]`);
      const updated = await api.getAssessmentById(assessment.id);
      setAssessment(updated);
      if (onLeadUpdated) onLeadUpdated();
      // Reload gate checklist
      loadWorkspaceData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to calculate PLD score.');
    } finally {
      setSavingScore(false);
    }
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProbName.trim()) {
      alert('Problem description or title is mandatory.');
      return;
    }

    setSavingProblem(true);
    try {
      await api.addLeadProblem(lead.id, {
        problem_name: newProbName.trim(),
        category: newProbCategory,
        severity: newProbSeverity,
        frequency: newProbFrequency,
        business_impact: newProbImpact,
        affected_users: newProbUsers,
        evidence: newProbEvidence,
        notes: newProbNotes,
      });

      showNotification('success', 'Documented business problem recorded successfully.');
      setShowAddProblemModal(false);
      // Reset form
      setNewProbName('');
      setNewProbImpact('');
      setNewProbUsers('');
      setNewProbEvidence('');
      setNewProbNotes('');

      // Refresh problems list
      const updatedProbs = await api.getLeadProblems(lead.id);
      setProblems(updatedProbs);

      // Re-evaluate score to lift cap if necessary
      if (assessment) {
        await api.evaluatePLDScore(assessment.id, answers);
        const updated = await api.getAssessmentById(assessment.id);
        setAssessment(updated);
      }
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to save business problem.');
    } finally {
      setSavingProblem(false);
    }
  };

  const handleScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError('A documented business justification reason is mandatory for score override.');
      return;
    }

    if (!assessment) return;

    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      const res = await api.overrideAssessment(
        assessment.id,
        overrideReason.trim(),
        overrideClassification,
        overrideScore
      );
      showNotification('success', res.message || 'PLD score manually overridden.');
      setShowOverrideModal(false);
      setOverrideReason('');
      const updated = await api.getAssessmentById(assessment.id);
      setAssessment(updated);
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      setOverrideError(err.message || 'Override failed.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleAdvanceToDiscovery = async () => {
    // Check gate requirements
    const isIcpPassed = assessment?.icp_result === 'PASS';
    const hasProblem = problems.length > 0;
    const hasNextAction = Boolean(lead.next_action_description);

    if (!isIcpPassed) {
      alert('GATE BLOCKED: Cannot advance to Discovery. ICP requirement not satisfied (Current status: ' + (assessment?.icp_result || 'PENDING') + ').');
      return;
    }

    if (!hasProblem) {
      alert('GATE BLOCKED: Cannot advance to Discovery. At least 1 documented business problem is required.');
      return;
    }

    if (!hasNextAction) {
      alert('GATE BLOCKED: A concrete next action and scheduled due date are required before progressing.');
      return;
    }

    setTransitioning(true);
    try {
      const configs = await api.getConfigurations();
      const currentConfig = configs.results?.find((c: any) => c.product === lead.primary_product) || configs.results?.[0];
      const discoveryStage = currentConfig?.stages?.find((s: any) => s.code === 'DISCOVERY' || s.name?.includes('Discovery') || s.sequence_order === 4);
      
      if (!discoveryStage) {
        throw new Error('Target Discovery pipeline stage not found in product configuration.');
      }

      const res = await api.transitionLeadStage(
        lead.id,
        discoveryStage.id,
        `Passed Phase 4 ICP and PLD Qualification Engine gates (Score: ${assessment?.pld_score || 0}).`
      );

      showNotification('success', res.message || 'Lead successfully advanced to Discovery!');
      if (onTransitionSuccess) onTransitionSuccess();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      alert(err.message || 'Stage transition failed.');
    } finally {
      setTransitioning(false);
    }
  };

  // Helper for ICP status badge styling
  const renderICPBadge = (result?: string) => {
    switch (result) {
      case 'PASS':
        return <span className="badge badge-success"><CheckCircle2 size={13} /> ICP: PASSED</span>;
      case 'FAIL':
        return <span className="badge badge-danger"><XCircle size={13} /> ICP: FAILED</span>;
      case 'REVIEW_REQUIRED':
        return <span className="badge badge-warning"><AlertTriangle size={13} /> ICP: REVIEW REQUIRED</span>;
      default:
        return <span className="badge badge-neutral"><Clock size={13} /> ICP: PENDING EVALUATION</span>;
    }
  };

  // Helper for PLD score outcome badge styling
  const renderScoreClassificationBadge = (classification?: string) => {
    switch (classification) {
      case 'HIGH_PRIORITY':
        return <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.25)', borderColor: 'var(--success)' }}>HIGH PRIORITY</span>;
      case 'QUALIFIED':
        return <span className="badge badge-info" style={{ background: 'rgba(56, 189, 248, 0.25)', borderColor: 'var(--info)' }}>QUALIFIED PLD</span>;
      case 'DEVELOPMENT':
        return <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', borderColor: 'var(--warning)' }}>PLD DEVELOPMENT</span>;
      case 'NURTURE':
      default:
        return <span className="badge badge-neutral">NURTURE</span>;
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 12px auto', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Loading PLD Qualification Workspace...</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Fetching dynamic ICP rules, questionnaires, and business problems
        </div>
      </div>
    );
  }

  const isScoreCapped = Boolean(
    assessment?.pld_breakdown?.why_score_exists?.includes('capped') ||
    (assessment?.pld_score && assessment.pld_score > 60 && problems.length === 0)
  );

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: feedbackMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge badge-info" style={{ fontWeight: 800 }}>
                {lead.primary_product_name || 'VanForces'}
              </span>
              {renderICPBadge(assessment?.icp_result)}
              {assessment && (
                <span className="badge badge-neutral">
                  Fit Score: {assessment.icp_fit_score || 0}/100
                </span>
              )}
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              {lead.account_name}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Lead ID: #{lead.id.slice(0, 8)} • Stage: <strong style={{ color: 'var(--text-primary)' }}>{lead.current_stage_name || 'PLD Qualified'}</strong> • Rule Ver: {assessment?.icp_rule_version || 'v1.0'}
            </div>
          </div>

          {/* Right Header Status Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                PLD Total Score
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>
                  {assessment?.pld_score ?? 0}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                {renderScoreClassificationBadge(assessment?.score_classification)}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleReEvaluateICP}
              disabled={evaluatingICP}
              title="Re-run product ICP knock-out rules & fit score"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px' }}
            >
              <RefreshCw size={15} className={evaluatingICP ? 'animate-spin' : ''} />
              Re-eval ICP
            </button>
          </div>
        </div>

        {/* Capped Score Warning Alert */}
        {isScoreCapped && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: 'var(--warning)'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>QUALIFICATION GATE ENFORCED:</strong> {assessment?.pld_breakdown?.why_score_exists || 'Score is capped at DEVELOPMENT because at least one documented business problem is required before qualifying.'}
            </div>
          </div>
        )}

        {/* OVERRIDDEN NOTICE BANNER */}
        {assessment?.original_pld_score !== undefined && assessment.original_pld_score !== null && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid var(--accent-purple)',
            fontSize: '0.8rem',
            color: '#DDD6FE',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>Manual Score Override Active:</strong> Original calculated score was <strong>{assessment.original_pld_score}</strong>, manually adjusted to <strong>{assessment.pld_score}</strong>.
              <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
                Reason: "{assessment.override_reason}" (by {assessment.overridden_by_name || 'Authorized Manager'})
              </div>
            </div>
            <span className="badge" style={{ background: 'var(--accent-purple)', color: '#FFFFFF' }}>OVERRIDDEN</span>
          </div>
        )}
      </div>

      {/* SECTION TABS */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSection('questionnaire')}
          className={`btn ${activeSection === 'questionnaire' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <FileText size={14} />
          Qualification Questionnaire ({questionnaire?.questions?.length || 0})
        </button>
        <button
          onClick={() => setActiveSection('problems')}
          className={`btn ${activeSection === 'problems' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px', position: 'relative' }}
        >
          <AlertCircle size={14} />
          Business Problems ({problems.length})
          {problems.length === 0 && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', marginLeft: '4px' }}></span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('score')}
          className={`btn ${activeSection === 'score' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <Scale size={14} />
          PLD Score Dimensions
        </button>
        <button
          onClick={() => setActiveSection('icp')}
          className={`btn ${activeSection === 'icp' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <ShieldCheck size={14} />
          ICP Gate & Breakdown
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`btn ${activeSection === 'history' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <History size={14} />
          Audit & History
        </button>
      </div>

      {/* TAB 1: QUESTIONNAIRE */}
      {activeSection === 'questionnaire' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {questionnaire?.name || 'VanForces PLD Qualification Questionnaire'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Template Ver: {questionnaire?.version_number || '1.0'} • Feeds 6 deterministic PLD score dimensions
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCalculateScore}
              disabled={savingScore}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={savingScore ? 'animate-spin' : ''} />
              {savingScore ? 'Calculating Score...' : 'Calculate PLD Score'}
            </button>
          </div>

          {questionnaire && questionnaire.questions && questionnaire.questions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '580px', overflowY: 'auto', paddingRight: '6px' }}>
              {questionnaire.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--primary)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Q{idx + 1}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>
                        {q.question_text}
                      </span>
                      {q.is_required && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>*Required</span>
                      )}
                    </div>

                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                      Feeds: {q.feeds_dimension || 'GENERAL'}
                    </span>
                  </div>

                  {q.help_text && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      {q.help_text}
                    </div>
                  )}

                  {/* Options render */}
                  {q.question_type === 'SINGLE_SELECT' || q.question_type === 'BOOLEAN' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '8px' }}>
                      {q.options && q.options.map(opt => {
                        const isSelected = answers[q.code] === opt.code || answers[q.code] === opt.label;
                        return (
                          <label
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface-elevated)',
                              border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="radio"
                              name={q.code}
                              value={opt.code}
                              checked={isSelected}
                              onChange={() => handleAnswerChange(q.code, opt.code)}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <div style={{ flex: 1 }}>
                              <span>{opt.label}</span>
                              {opt.knockout_flag && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--danger)', marginLeft: '6px' }}>
                                  (Knockout)
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              +{opt.score_value}pts
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : q.question_type === 'NUMERIC' ? (
                    <input
                      type="number"
                      className="form-input"
                      value={answers[q.code] || ''}
                      onChange={e => handleAnswerChange(q.code, e.target.value)}
                      placeholder="Enter numeric value..."
                      style={{ width: '100%', maxWidth: '240px', marginTop: '6px' }}
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={answers[q.code] || ''}
                      onChange={e => handleAnswerChange(q.code, e.target.value)}
                      placeholder="Enter qualification details..."
                      style={{ width: '100%', marginTop: '6px' }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active qualification questionnaire found for product {lead.primary_product_name}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUSINESS PROBLEMS */}
      {activeSection === 'problems' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Documented Business Problems ({problems.length})
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Mandatory Gate: At least 1 documented problem is required. Captured problems automatically carry into Discovery.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowAddProblemModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              Record Business Problem
            </button>
          </div>

          {problems.length === 0 ? (
            <div style={{
              padding: '24px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px dashed var(--danger)',
              textAlign: 'center'
            }}>
              <AlertTriangle size={24} color="var(--danger)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>
                No Business Problem Documented Yet
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 14px auto' }}>
                A PLD cannot qualify without a documented business problem. Score is currently capped at DEVELOPMENT.
              </p>
              <button
                className="btn btn-danger"
                onClick={() => setShowAddProblemModal(true)}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                + Capture Problem Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {problems.map((prob) => (
                <div
                  key={prob.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    borderLeft: `4px solid ${prob.severity === 'CRITICAL' ? 'var(--danger)' : prob.severity === 'HIGH' ? 'var(--warning)' : 'var(--primary)'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>
                          {prob.problem_name}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                          {prob.category}
                        </span>
                      </div>
                      {prob.business_impact && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <strong>Impact:</strong> {prob.business_impact}
                        </div>
                      )}
                      {prob.affected_users && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <strong>Affected Users/Teams:</strong> {prob.affected_users}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className={`badge ${prob.severity === 'CRITICAL' ? 'badge-danger' : prob.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}`}>
                        {prob.severity}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Freq: {prob.frequency}
                      </span>
                    </div>
                  </div>

                  {prob.evidence && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface-elevated)',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <strong>Evidence:</strong> {prob.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLD SCORE DIMENSIONS */}
      {activeSection === 'score' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                6-Dimension Deterministic PLD Score Breakdown
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Weights: Severity 25%, Value 20%, Decision 15%, Timeline 10%, Tech Fit 15%, Commercial 15%
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowOverrideModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              <UserCheck size={14} />
              Manual Score Override
            </button>
          </div>

          {/* Dimension Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {[
              { dim: 'PROBLEM_SEVERITY', label: 'Problem Severity', weight: 25, defaultPoints: 20 },
              { dim: 'BUSINESS_VALUE', label: 'Business Value', weight: 20, defaultPoints: 16 },
              { dim: 'DECISION_ACCESS', label: 'Decision-Maker Access', weight: 15, defaultPoints: 12 },
              { dim: 'TIMELINE', label: 'Implementation Timeline', weight: 10, defaultPoints: 8 },
              { dim: 'TECHNICAL_FIT', label: 'Technical Fit / ERP', weight: 15, defaultPoints: 12 },
              { dim: 'COMMERCIAL_POTENTIAL', label: 'Commercial Potential', weight: 15, defaultPoints: 12 },
            ].map(item => {
              const dimRecord = assessment?.dimension_scores?.find(ds => ds.dimension === item.dim);
              const scoreEarned = dimRecord?.score ?? (assessment ? Math.round((assessment.pld_score / 100) * item.weight) : 0);
              const weightedContribution = dimRecord?.weighted_score ?? scoreEarned;

              return (
                <div
                  key={item.dim}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {item.label}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                        Weight {item.weight}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {scoreEarned}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        / {item.weight} pts (Contrib: {weightedContribution}%)
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div style={{ height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((scoreEarned / item.weight) * 100))}%`,
                          background: 'var(--primary)',
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {dimRecord?.evidence_notes || `Evaluated from qualification questionnaire responses for ${item.label}.`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structured Score Explanation */}
          {assessment?.pld_breakdown && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-cyan)' }}>
                Deterministic Score Rationale &amp; Audit Trail
              </h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Why the score exists:</strong> {assessment.pld_breakdown.why_score_exists}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Recommended Next Action:</strong> {assessment.pld_breakdown.what_to_do_next}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ICP GATE & BREAKDOWN (The 4-Part Structure) */}
      {activeSection === 'icp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Product-Specific ICP Gate Evaluation
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Evaluated per product: Knock-out rules must pass, followed by 0-100 fit score criteria
              </p>
            </div>

            {renderICPBadge(assessment?.icp_result)}
          </div>

          {/* 4-Part Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            
            {/* 1. WHAT WE KNOW */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <CheckCircle2 size={14} /> WHAT WE KNOW
              </div>
              {assessment?.icp_breakdown?.what_we_know && assessment.icp_breakdown.what_we_know.length > 0 ? (
                <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {assessment.icp_breakdown.what_we_know.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account profile data evaluated.</div>
              )}
            </div>

            {/* 2. WHAT IS MISSING */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: assessment?.icp_breakdown?.what_is_missing?.length ? 'var(--warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={14} /> WHAT IS MISSING
              </div>
              {assessment?.icp_breakdown?.what_is_missing && assessment.icp_breakdown.what_is_missing.length > 0 ? (
                <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--warning)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {assessment.icp_breakdown.what_is_missing.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>All required ICP profile fields are present.</div>
              )}
            </div>

            {/* 3. WHY THE RESULT OCCURRED */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <HelpCircle size={14} /> WHY THE RESULT OCCURRED
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {assessment?.icp_breakdown?.why_result_occurred || 'Evaluated against published VanForces knockout and scoring criteria.'}
              </div>
            </div>

            {/* 4. WHAT THE USER SHOULD DO NEXT */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ArrowRight size={14} /> WHAT TO DO NEXT
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {assessment?.icp_breakdown?.what_to_do_next || 'Proceed with PLD qualification questionnaire and record business problems.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT & HISTORY */}
      {activeSection === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Qualification History &amp; Version Audit Trail
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Immutable chronological record of score calculations, model versions, and manual overrides.
          </p>

          {assessment?.qualification_history && assessment.qualification_history.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assessment.qualification_history.map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    borderLeft: `3px solid ${entry.action === 'SCORE_OVERRIDE' ? 'var(--accent-purple)' : 'var(--primary)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                        {entry.action || 'SCORE_CALCULATION'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        Score: {entry.score} ({entry.classification})
                      </span>
                      {entry.model_version && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Model: {entry.model_version}
                        </span>
                      )}
                    </div>
                    {entry.reason && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Reason: {entry.reason}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <div>{entry.user_name || 'System / Evaluator'}</div>
                    <div>{entry.calculated_at ? new Date(entry.calculated_at).toLocaleString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No previous qualification history entries found for this assessment.
            </div>
          )}
        </div>
      )}

      {/* BOTTOM ACTION & GATE READINESS BAR */}
      <div style={{
        marginTop: '8px',
        padding: '16px',
        borderRadius: '10px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Next Scheduled Action
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px', color: '#FFFFFF' }}>
            {lead.next_action_description || 'No next action scheduled (Action required to advance)'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Due: {lead.next_activity_due_at ? new Date(lead.next_activity_due_at).toLocaleDateString() : 'Pending schedule'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Gate Mini Checklist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
            <span style={{ color: assessment?.icp_result === 'PASS' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {assessment?.icp_result === 'PASS' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} ICP Pass
            </span>
            <span style={{ color: problems.length > 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {problems.length > 0 ? <CheckCircle2 size={14} /> : <XCircle size={14} />} ≥1 Problem
            </span>
            <span style={{ color: lead.next_action_description ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {lead.next_action_description ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Next Action
            </span>
            {gateChecklist && !gateChecklist.all_passed && (
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                Stage Gates Pending
              </span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleAdvanceToDiscovery}
            disabled={transitioning || assessment?.icp_result !== 'PASS' || problems.length === 0 || !lead.next_action_description}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
          >
            {transitioning ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
            Advance to Discovery Stage
          </button>
        </div>
      </div>

      {/* MODAL 1: ADD BUSINESS PROBLEM */}
      {showAddProblemModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '24px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Record Documented Business Problem</h3>
              <button
                className="btn btn-outline"
                style={{ padding: '4px 8px' }}
                onClick={() => setShowAddProblemModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProblem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Problem Description / Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newProbName}
                  onChange={e => setNewProbName(e.target.value)}
                  placeholder="e.g., Manual paper receipts causing reconciliation delays and driver overtime"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Category
                  </label>
                  <select
                    className="form-select"
                    value={newProbCategory}
                    onChange={e => setNewProbCategory(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="DISTRIBUTION">Distribution Operations</option>
                    <option value="DISPATCH">Dispatch &amp; Fleet</option>
                    <option value="ROUTING">Route Planning</option>
                    <option value="COLLECTIONS">Collections &amp; Invoicing</option>
                    <option value="INVENTORY">Van Stock Checks</option>
                    <option value="ERP_INTEGRATION">ERP Integration</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Severity
                  </label>
                  <select
                    className="form-select"
                    value={newProbSeverity}
                    onChange={e => setNewProbSeverity(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="CRITICAL">Critical (Blocking)</option>
                    <option value="HIGH">High Impact</option>
                    <option value="MEDIUM">Medium Impact</option>
                    <option value="LOW">Low Impact</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Frequency
                  </label>
                  <select
                    className="form-select"
                    value={newProbFrequency}
                    onChange={e => setNewProbFrequency(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="OCCASIONAL">Occasional</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Affected Teams / Users
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newProbUsers}
                    onChange={e => setNewProbUsers(e.target.value)}
                    placeholder="e.g. 25 Van Drivers, 3 Dispatchers"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Business Impact
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={newProbImpact}
                  onChange={e => setNewProbImpact(e.target.value)}
                  placeholder="e.g., Estimated $45,000 monthly leakage due to unverified returned inventory and billing discrepancies"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Evidence / Customer Quotes
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={newProbEvidence}
                  onChange={e => setNewProbEvidence(e.target.value)}
                  placeholder="e.g. Confirmed by Operations Director during intake call"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddProblemModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProblem}
                >
                  {savingProblem ? 'Saving...' : 'Save Problem & Update Gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL SCORE OVERRIDE */}
      {showOverrideModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '24px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={20} color="var(--accent-purple)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Authorized Score Override</h3>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '4px 8px' }}
                onClick={() => setShowOverrideModal(false)}
              >
                ✕
              </button>
            </div>

            {overrideError && (
              <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '12px' }}>
                {overrideError}
              </div>
            )}

            <form onSubmit={handleScoreOverride} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Calculated Score:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {assessment?.pld_score || 0} / 100
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  New Score Value (0 - 100) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="form-input"
                  value={overrideScore}
                  onChange={e => setOverrideScore(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  New Score Classification
                </label>
                <select
                  className="form-select"
                  value={overrideClassification}
                  onChange={e => setOverrideClassification(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="HIGH_PRIORITY">HIGH PRIORITY (81 - 100)</option>
                  <option value="QUALIFIED">QUALIFIED PLD (61 - 80)</option>
                  <option value="DEVELOPMENT">PLD DEVELOPMENT (31 - 60)</option>
                  <option value="NURTURE">NURTURE (0 - 30)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Documented Override Reason (Mandatory Audit Trail) *
                </label>
                <textarea
                  className="form-input"
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="e.g. Confirmed C-level executive sponsorship and validated urgent dispatch replacement budget for Q3"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowOverrideModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={overrideSubmitting}
                  style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                >
                  {overrideSubmitting ? 'Submitting Override...' : 'Apply Authorized Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
