import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Mail, ArrowRight,
  CheckCircle2, AlertCircle, KeyRound, Loader2,
  Layers, Cpu, Activity, Database
} from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username: targetEmail, password: targetPass });
      if (res && res.user) {
        if (res.access) {
          localStorage.setItem('texol_access_token', res.access);
        }
        if (res.refresh) {
          localStorage.setItem('texol_refresh_token', res.refresh);
        }
        localStorage.setItem('texol_auth_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        setError('Login failed: Invalid server response.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    handleQuickLogin(username, password);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflowX: 'hidden',
      padding: '40px 20px',
      boxSizing: 'border-box'
    }}>
      {/* Background Decorative Ambient Glows */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(99, 102, 241, 0) 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0) 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Centered Container */}
      <div style={{
        width: '100%',
        maxWidth: '1120px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            color: '#818CF8',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}>
            <ShieldCheck size={14} color="#818CF8" />
            <span>Role-Based Access Control (RBAC) • Multi-Product CRM</span>
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              TEXOL CRM
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '1.8rem', fontWeight: 300 }}>|</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 600 }}>Revenue Operations</span>
          </h1>

          <p style={{
            fontSize: '0.92rem',
            color: 'var(--text-secondary)',
            maxWidth: '580px',
            margin: '0 auto',
            lineHeight: 1.5
          }}>
            Configurable Product-Led Discovery (PLD) platform for VanForces, TaskForces ERP, and EntAura.AI.
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          
          {/* Left Column: Sign In with Credentials */}
          <div style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                <KeyRound size={18} color="#818CF8" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Sign In with Credentials
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Platform Administrator or Staff Access
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <AlertCircle size={16} color="#F87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Email or Username
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-muted)" style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter email or username"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text-muted)" style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Platform</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>1-Click RBAC Role Testing:</span>
                  <span style={{ fontSize: '0.65rem', textTransform: 'none', color: 'var(--primary)' }}>Auto-logs in</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    { role: 'Platform Admin', email: 'admin@texol.com', pass: 'Admin@Texol2026!', badge: 'badge-primary' },
                    { role: 'TEXOL Management', email: 'management@texol.com', pass: 'TexolDemo2026!', badge: 'badge-warning' },
                    { role: 'Sales Manager', email: 'sales.manager@texol.com', pass: 'TexolDemo2026!', badge: 'badge-warning' },
                    { role: 'Sales / BDM (AE)', email: 'sales.ae@texol.com', pass: 'TexolDemo2026!', badge: 'badge-success' },
                    { role: 'PLD Executive', email: 'pld.exec@texol.com', pass: 'TexolDemo2026!', badge: 'badge-info' },
                    { role: 'Solution Consultant', email: 'solution.consultant@texol.com', pass: 'TexolDemo2026!', badge: 'badge-neutral' },
                    { role: 'Marketing & Growth', email: 'marketing@texol.com', pass: 'TexolDemo2026!', badge: 'badge-info' },
                    { role: 'Product Manager', email: 'product.manager@texol.com', pass: 'TexolDemo2026!', badge: 'badge-primary' },
                    { role: 'Customer Success', email: 'customer.success@texol.com', pass: 'TexolDemo2026!', badge: 'badge-success' },
                    { role: 'Partner Manager', email: 'partner.manager@texol.com', pass: 'TexolDemo2026!', badge: 'badge-warning' },
                    { role: 'Partner User', email: 'partner.user@texol.com', pass: 'TexolDemo2026!', badge: 'badge-primary' },
                    { role: 'Finance / Ops', email: 'finance@texol.com', pass: 'TexolDemo2026!', badge: 'badge-neutral' },
                  ].map(r => (
                    <button
                      key={r.email}
                      type="button"
                      disabled={loading}
                      title={`Login as ${r.role} (${r.email})`}
                      onClick={() => {
                        setUsername(r.email);
                        setPassword(r.pass);
                        handleQuickLogin(r.email, r.pass);
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.role}</span>
                      <span className={`badge ${r.badge}`} style={{ fontSize: '0.6rem', padding: '1px 5px', flexShrink: 0, marginLeft: '4px' }}>Demo</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>

            <div style={{
              marginTop: 'auto',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="#10B981" />
                <span>Session authenticated with CSRF &amp; Secure Token</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="#10B981" />
                <span>Fine-grained permissions per entity stage &amp; workspace</span>
              </div>
            </div>
          </div>

          {/* Right Column: Platform Architecture & Security */}
          <div style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}>
                <Cpu size={18} color="#22D3EE" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Enterprise Revenue Architecture
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Configurable Product-Led Development &amp; Operations
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#818CF8',
                  marginTop: '2px'
                }}>
                  <Layers size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    Configurable PLD Engine
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Objective lead qualification with 6-dimension scoring matrix, problem-to-capability discovery mapping, and configurable stage gates.
                  </p>
                </div>
              </div>

              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34D399',
                  marginTop: '2px'
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    Multi-Product Commercial Core
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Multi-product accounts, opportunity line-items, and authorized partner deal registration with 90-day exclusivity protection.
                  </p>
                </div>
              </div>

              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#FBBF24',
                  marginTop: '2px'
                }}>
                  <Activity size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    SLA Timers &amp; Audit Governance
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Strict 48h lead response and SQL sales acceptance timers, universal audit ledger, and multi-tier discount approval gates.
                  </p>
                </div>
              </div>

              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: '#22D3EE',
                  marginTop: '2px'
                }}>
                  <Database size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    ERP Sync Gateway &amp; Analytics
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Bi-directional master data connector for external ERPs (Odoo, SAP, Dynamics), multi-touch attribution, and pipeline leakage analytics.
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />
              <span>Production-ready environment. Access requires authorized staff or administrator credentials.</span>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          TEXOL Configurable PLD CRM Platform • Enterprise Edition • Production Ready
        </div>
      </div>
    </div>
  );
};
