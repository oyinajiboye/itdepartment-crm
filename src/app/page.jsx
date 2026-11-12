'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { INITIAL_CRM_DATA } from '@/data/seedData';

function formatNaira(amount) {
  return '\u20A6' + Number(amount || 0).toLocaleString('en-NG');
}

function generateCompanyCode(name, count) {
  const slug = (name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const num = String((count || 0) + 1).padStart(2, '0');
  return `ITD-${slug || 'CLIENT'}-${num}`;
}

const PLAN_PRICES = {
  'Starter Office SLA': { retainer: 150000, max_pcs: 15 },
  'Growth Department SLA': { retainer: 300000, max_pcs: 40 },
  'Enterprise Managed SLA': { retainer: 550000, max_pcs: 80 },
  '7-Day Free Office Pilot': { retainer: 0, max_pcs: 10 },
};

export default function CRMPlatformPage() {
  // Session & Auth States
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sign-In Form
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Flow A: First-Run 3-Step Workspace Setup Wizard
  const [inFirstRunWizard, setInFirstRunWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [superMgrForm, setSuperMgrForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [firstItMgrForm, setFirstItMgrForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: 'Systems, Network & Endpoint Lead',
    password: '',
  });
  const [firstCompForm, setFirstCompForm] = useState({
    name: '',
    industry: 'Corporate Enterprise',
    plan_tier: 'Growth Department SLA',
    monthly_retainer: 300000,
    max_pcs: 40,
    domain_name: '',
    assigned_manager_id: '',
    ceo_contact: '',
    hr_contact: '',
    admin_contact: '',
    company_code: 'ITD-CLIENT-01',
  });
  const [firstCreatedCompany, setFirstCreatedCompany] = useState(null);

  // CRM Store & Workspace Navigation
  const [state, setState] = useState(INITIAL_CRM_DATA);
  const [activeView, setActiveView] = useState('overview');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [copiedKey, setCopiedKey] = useState('');

  // Modal States
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showCompanyWizard, setShowCompanyWizard] = useState(false);
  const [companyWizardStep, setCompanyWizardStep] = useState(1);
  const [onboardedCompanyResult, setOnboardedCompanyResult] = useState(null);
  const [showHrWebModal, setShowHrWebModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);

  // Create IT Manager Form
  const [mgrForm, setMgrForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: 'Systems, Network & Endpoint Lead',
    password: '',
  });

  // Flow B: 3-Step Onboard New Client Company Wizard Form
  const [compForm, setCompForm] = useState({
    name: '',
    company_code: '',
    industry: 'Corporate Enterprise',
    plan_tier: 'Growth Department SLA',
    monthly_retainer: 300000,
    max_pcs: 40,
    assigned_manager_id: '',
    ceo_contact: '',
    hr_contact: '',
    admin_contact: '',
    domain_name: '',
  });

  // HR / Website Task Form
  const [hrWebForm, setHrWebForm] = useState({
    company_code: '',
    task_type: 'HR Onboarding',
    title: '',
    requested_by: '',
  });

  const loadWorkspaceData = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/bootstrap', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setState({
          managers: data.managers || [],
          companies: data.companies || [],
          devices: data.devices || [],
          fix_logs: data.fix_logs || [],
          tickets: data.tickets || [],
          hr_web_tasks: data.hr_web_tasks || [],
          onboarding_completed: Boolean(data.onboarding_completed),
        });
      }
    } catch {
      // Keep clean state
    }
  }, []);

  const checkSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNeedsSetup(Boolean(data.needs_setup));
        if (data.needs_setup) {
          setInFirstRunWizard(true);
          setSetupStep(1);
        }
        if (data.authenticated && data.user) {
          setAuthenticated(true);
          setCurrentUser(data.user);
          await loadWorkspaceData();
        } else {
          setAuthenticated(false);
          setCurrentUser(null);
        }
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, [loadWorkspaceData]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const isSuperManager = currentUser?.role === 'super_manager';

  const itManagers = useMemo(() => {
    return (state.managers || []).filter((m) => m.role === 'it_manager');
  }, [state.managers]);

  const assignableManagers = useMemo(() => {
    return state.managers || [];
  }, [state.managers]);

  const scopedCompanies = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperManager) return state.companies || [];
    return (state.companies || []).filter(
      (c) => String(c.assigned_manager_id) === String(currentUser.id)
    );
  }, [state.companies, isSuperManager, currentUser]);

  const visibleCompanyCodes = useMemo(() => {
    if (
      companyFilter !== 'ALL' &&
      scopedCompanies.some((c) => c.company_code === companyFilter)
    ) {
      return new Set([companyFilter]);
    }
    return new Set(scopedCompanies.map((c) => c.company_code));
  }, [scopedCompanies, companyFilter]);

  const visibleCompanies = useMemo(
    () => scopedCompanies.filter((c) => visibleCompanyCodes.has(c.company_code)),
    [scopedCompanies, visibleCompanyCodes]
  );
  const visibleDevices = useMemo(
    () => (state.devices || []).filter((d) => visibleCompanyCodes.has(d.company_code)),
    [state.devices, visibleCompanyCodes]
  );
  const visibleFixes = useMemo(
    () => (state.fix_logs || []).filter((f) => visibleCompanyCodes.has(f.company_code)),
    [state.fix_logs, visibleCompanyCodes]
  );
  const visibleTickets = useMemo(
    () => (state.tickets || []).filter((t) => visibleCompanyCodes.has(t.company_code)),
    [state.tickets, visibleCompanyCodes]
  );
  const visibleHrWeb = useMemo(
    () => (state.hr_web_tasks || []).filter((t) => visibleCompanyCodes.has(t.company_code)),
    [state.hr_web_tasks, visibleCompanyCodes]
  );

  const openTicketsCount = useMemo(
    () => visibleTickets.filter((t) => t.status !== 'Resolved').length,
    [visibleTickets]
  );

  const getManagerName = (mgrId) => {
    if (!mgrId) return 'Unassigned';
    const found = (state.managers || []).find((m) => String(m.id) === String(mgrId));
    if (found) return found.name;
    if (currentUser && String(currentUser.id) === String(mgrId)) return currentUser.name;
    return 'Assigned Manager';
  };

  const getCompanyByCode = (code) => {
    return (state.companies || []).find((c) => c.company_code === code);
  };

  const handleCopy = (text, key) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // ============================================================================
  // Auth Handlers (Login, Logout, First-Run Setup Wizard)
  // ============================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Invalid email or password.');
        return;
      }
      setAuthenticated(true);
      setCurrentUser(data.user);
      setNeedsSetup(false);
      setInFirstRunWizard(false);
      await loadWorkspaceData();
    } catch {
      setAuthError('Unable to reach authentication server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuthenticated(false);
    setCurrentUser(null);
    setState(INITIAL_CRM_DATA);
    setLoginForm({ email: '', password: '' });
  };

  // Flow A — Step 1: Create Founder / Super Manager Account
  const handleSetupStep1 = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(superMgrForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Could not create Super Manager account.');
        return;
      }
      setAuthenticated(true);
      setCurrentUser(data.user);
      setNeedsSetup(false);
      setFirstCompForm((prev) => ({ ...prev, assigned_manager_id: data.user.id }));
      await loadWorkspaceData();
      setSetupStep(2);
    } catch {
      setAuthError('Network error during workspace setup.');
    } finally {
      setSubmitting(false);
    }
  };

  // Flow A — Step 2: Create First IT Manager Account (or skip)
  const handleSetupStep2 = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstItMgrForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Could not create IT Manager account.');
        return;
      }
      await loadWorkspaceData();
      setFirstCompForm((prev) => ({ ...prev, assigned_manager_id: data.id }));
      setSetupStep(3);
    } catch {
      setAuthError('Failed to create IT Manager.');
    } finally {
      setSubmitting(false);
    }
  };

  // Flow A — Step 3: Register First Client Company & Generate Company Code
  const handleSetupStep3 = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...firstCompForm,
          assigned_manager_id: firstCompForm.assigned_manager_id || currentUser?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Could not register client company.');
        return;
      }
      setFirstCreatedCompany(data);
      await loadWorkspaceData();
    } catch {
      setAuthError('Failed to register client company.');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // CRM Operations Handlers
  // ============================================================================
  const openGuidedCompanyWizard = () => {
    const defaultMgr = itManagers[0]?.id || currentUser?.id || '';
    const defaultCode = generateCompanyCode('CLIENT', state.companies.length);
    setCompForm({
      name: '',
      company_code: defaultCode,
      industry: 'Corporate Enterprise',
      plan_tier: 'Growth Department SLA',
      monthly_retainer: 300000,
      max_pcs: 40,
      assigned_manager_id: defaultMgr,
      ceo_contact: '',
      hr_contact: '',
      admin_contact: '',
      domain_name: '',
    });
    setOnboardedCompanyResult(null);
    setCompanyWizardStep(1);
    setAuthError('');
    setShowCompanyWizard(true);
  };

  const handleCreateCompanyWizardSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...compForm,
          company_code: compForm.company_code.trim().toUpperCase(),
          assigned_manager_id: compForm.assigned_manager_id || currentUser?.id,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        setAuthError(created.error || 'Failed to onboard company.');
        return;
      }
      setOnboardedCompanyResult(created);
      setCompanyWizardStep(3);
      await loadWorkspaceData();
    } catch {
      setAuthError('Network error while onboarding company.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mgrForm),
      });
      const created = await res.json();
      if (!res.ok) {
        setAuthError(created.error || 'Could not create IT Manager.');
        return;
      }
      await loadWorkspaceData();
      setMgrForm({
        name: '',
        email: '',
        phone: '',
        specialization: 'Systems, Network & Endpoint Lead',
        password: '',
      });
      setShowManagerModal(false);
    } catch {
      setAuthError('Network error creating IT Manager.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassignCompany = async (companyCode, newManagerId) => {
    try {
      const res = await fetch(`/api/crm/companies/${encodeURIComponent(companyCode)}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_manager_id: newManagerId }),
      });
      if (res.ok) {
        await loadWorkspaceData();
      }
    } catch {}
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!editingTicket) return;
    const ticketId = editingTicket.id || editingTicket.ticket_id;
    try {
      const res = await fetch(`/api/crm/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editingTicket.status,
          manager_reply: editingTicket.manager_reply,
          assigned_manager_id: editingTicket.assigned_manager_id,
        }),
      });
      if (res.ok) {
        await loadWorkspaceData();
      }
    } catch {}
    setEditingTicket(null);
  };

  const handleCreateHrWebTask = async (e) => {
    e.preventDefault();
    const targetCode = hrWebForm.company_code || scopedCompanies[0]?.company_code || '';
    if (!targetCode) return;
    try {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...hrWebForm,
          company_code: targetCode,
        }),
      });
      if (res.ok) {
        await loadWorkspaceData();
      }
    } catch {}
    setHrWebForm({
      company_code: scopedCompanies[0]?.company_code || '',
      task_type: 'HR Onboarding',
      title: '',
      requested_by: '',
    });
    setShowHrWebModal(false);
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const res = await fetch(`/api/crm/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' }),
      });
      if (res.ok) {
        await loadWorkspaceData();
      }
    } catch {}
  };

  const totalRetainer = visibleCompanies.reduce(
    (sum, c) => sum + (Number(c.monthly_retainer || c.retainer_ngn) || 0),
    0
  );
  const offlineFixesCount = visibleFixes.filter((f) => f.mode === 'offline_synced').length;

  // ============================================================================
  // Loading State
  // ============================================================================
  if (authLoading) {
    return (
      <>
        <header className="crm-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" className="crm-brand">
              <img src="/logo-full-light.svg" alt="IT Department" />
            </a>
            <span className="crm-badge">Next.js Multi-Company CRM</span>
          </div>
        </header>
        <div className="auth-screen">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
            VERIFYING WORKSPACE SESSION...
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // FLOW A: First-Run Workspace Setup & Onboarding Wizard (needs_setup === true)
  // ============================================================================
  if (needsSetup || inFirstRunWizard) {
    return (
      <>
        <header className="crm-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" className="crm-brand">
              <img src="/logo-full-light.svg" alt="IT Department" />
            </a>
            <span className="crm-badge">First-Run Production Setup</span>
          </div>
          {authenticated && currentUser && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              SUPER MANAGER: {currentUser.email}
            </div>
          )}
        </header>

        <div className="auth-screen">
          <div className="wizard-card">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                IT DEPARTMENT NG // PRODUCTION WORKSPACE INITIALIZATION
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                STEP {setupStep} OF 3
              </span>
            </div>

            <div className="wizard-steps">
              <div
                className={`wizard-step-tab ${
                  setupStep === 1 ? 'active' : setupStep > 1 ? 'done' : ''
                }`}
              >
                01 / Super Manager
              </div>
              <div
                className={`wizard-step-tab ${
                  setupStep === 2 ? 'active' : setupStep > 2 ? 'done' : ''
                }`}
              >
                02 / First IT Manager
              </div>
              <div className={`wizard-step-tab ${setupStep === 3 ? 'active' : ''}`}>
                03 / First Client Company
              </div>
            </div>

            <div className="modal-body">
              {authError && <div className="error-banner">{authError}</div>}

              {setupStep === 1 && (
                <form onSubmit={handleSetupStep1}>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--green)', marginBottom: 6 }}>
                    Step 1: Create Founder / Super Manager Account
                  </h2>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-muted)',
                      marginBottom: 20,
                    }}
                  >
                    This root account controls all client organisations, SLA retainers, and internal
                    IT Manager assignments.
                  </p>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Full Name *</label>
                      <input
                        type="text"
                        required
                        value={superMgrForm.name}
                        onChange={(e) =>
                          setSuperMgrForm({ ...superMgrForm, name: e.target.value })
                        }
                        placeholder="e.g. Oyin Ajiboye"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Official Work Email *</label>
                      <input
                        type="email"
                        required
                        value={superMgrForm.email}
                        onChange={(e) =>
                          setSuperMgrForm({ ...superMgrForm, email: e.target.value })
                        }
                        placeholder="founder@itdepartment.ng"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Direct Phone / WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={superMgrForm.phone}
                        onChange={(e) =>
                          setSuperMgrForm({ ...superMgrForm, phone: e.target.value })
                        }
                        placeholder="+234 803 000 0000"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Master Password (min. 6 chars) *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={superMgrForm.password}
                        onChange={(e) =>
                          setSuperMgrForm({ ...superMgrForm, password: e.target.value })
                        }
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-green"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Creating Super Manager Account...'
                      : 'Create Super Manager & Continue to Step 2 \u2192'}
                  </button>
                </form>
              )}

              {setupStep === 2 && (
                <form onSubmit={handleSetupStep2}>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--green)', marginBottom: 6 }}>
                    Step 2: Create First Internal IT Manager Account
                  </h2>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-muted)',
                      marginBottom: 20,
                    }}
                  >
                    IT Managers log in with their own email and password and see only the client
                    companies assigned to them.
                  </p>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>IT Manager Full Name *</label>
                      <input
                        type="text"
                        required
                        value={firstItMgrForm.name}
                        onChange={(e) =>
                          setFirstItMgrForm({ ...firstItMgrForm, name: e.target.value })
                        }
                        placeholder="e.g. Tunde Bakare"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>IT Manager Login Email *</label>
                      <input
                        type="email"
                        required
                        value={firstItMgrForm.email}
                        onChange={(e) =>
                          setFirstItMgrForm({ ...firstItMgrForm, email: e.target.value })
                        }
                        placeholder="tunde@itdepartment.ng"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Phone Number *</label>
                      <input
                        type="text"
                        required
                        value={firstItMgrForm.phone}
                        onChange={(e) =>
                          setFirstItMgrForm({ ...firstItMgrForm, phone: e.target.value })
                        }
                        placeholder="+234 803 000 0000"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Specialization</label>
                      <input
                        type="text"
                        value={firstItMgrForm.specialization}
                        onChange={(e) =>
                          setFirstItMgrForm({
                            ...firstItMgrForm,
                            specialization: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Temporary Login Password (min. 6 chars) *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={firstItMgrForm.password}
                      onChange={(e) =>
                        setFirstItMgrForm({ ...firstItMgrForm, password: e.target.value })
                      }
                      placeholder="Set initial password for this IT Manager"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setAuthError('');
                        setSetupStep(3);
                      }}
                    >
                      Skip for Later &rarr;
                    </button>
                    <button
                      type="submit"
                      className="btn btn-green"
                      style={{ flex: 2 }}
                      disabled={submitting}
                    >
                      {submitting
                        ? 'Creating IT Manager...'
                        : 'Create IT Manager & Continue to Step 3 \u2192'}
                    </button>
                  </div>
                </form>
              )}

              {setupStep === 3 && !firstCreatedCompany && (
                <form onSubmit={handleSetupStep3}>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--green)', marginBottom: 6 }}>
                    Step 3: Onboard First Client Company
                  </h2>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-muted)',
                      marginBottom: 20,
                    }}
                  >
                    Register your first B2B client organisation and generate their unique Company
                    Code for the Windows AI Support App.
                  </p>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Client Company Name *</label>
                      <input
                        type="text"
                        required
                        value={firstCompForm.name}
                        onChange={(e) => {
                          const nameVal = e.target.value;
                          setFirstCompForm({
                            ...firstCompForm,
                            name: nameVal,
                            company_code: generateCompanyCode(nameVal, 0),
                          });
                        }}
                        placeholder="e.g. Sterling Marine Ltd"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Unique Company Code (JetBrains Mono) *</label>
                      <input
                        type="text"
                        required
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        value={firstCompForm.company_code}
                        onChange={(e) =>
                          setFirstCompForm({
                            ...firstCompForm,
                            company_code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Retainer Plan Tier</label>
                      <select
                        value={firstCompForm.plan_tier}
                        onChange={(e) => {
                          const tier = e.target.value;
                          const preset = PLAN_PRICES[tier] || { retainer: 300000, max_pcs: 40 };
                          setFirstCompForm({
                            ...firstCompForm,
                            plan_tier: tier,
                            monthly_retainer: preset.retainer,
                            max_pcs: preset.max_pcs,
                          });
                        }}
                      >
                        <option value="Starter Office SLA">
                          Starter Office SLA (₦150,000/mo)
                        </option>
                        <option value="Growth Department SLA">
                          Growth Department SLA (₦300,000/mo)
                        </option>
                        <option value="Enterprise Managed SLA">
                          Enterprise Managed SLA (₦550,000/mo)
                        </option>
                        <option value="7-Day Free Office Pilot">
                          7-Day Free Office Pilot (₦0)
                        </option>
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Assigned IT Manager *</label>
                      <select
                        value={firstCompForm.assigned_manager_id}
                        onChange={(e) =>
                          setFirstCompForm({
                            ...firstCompForm,
                            assigned_manager_id: e.target.value,
                          })
                        }
                      >
                        {assignableManagers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role === 'super_manager' ? 'Super Manager' : 'IT Manager'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>CEO / MD Contact</label>
                      <input
                        type="text"
                        value={firstCompForm.ceo_contact}
                        onChange={(e) =>
                          setFirstCompForm({ ...firstCompForm, ceo_contact: e.target.value })
                        }
                        placeholder="Name & Phone / Email"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>HR / Admin Contact</label>
                      <input
                        type="text"
                        value={firstCompForm.hr_contact}
                        onChange={(e) =>
                          setFirstCompForm({
                            ...firstCompForm,
                            hr_contact: e.target.value,
                            admin_contact: e.target.value,
                          })
                        }
                        placeholder="HR Lead Name & Email"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Corporate Domain Name</label>
                    <input
                      type="text"
                      value={firstCompForm.domain_name}
                      onChange={(e) =>
                        setFirstCompForm({ ...firstCompForm, domain_name: e.target.value })
                      }
                      placeholder="company.com.ng"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setInFirstRunWizard(false)}
                    >
                      Skip to Dashboard
                    </button>
                    <button
                      type="submit"
                      className="btn btn-green"
                      style={{ flex: 2 }}
                      disabled={submitting}
                    >
                      {submitting
                        ? 'Registering Client Company...'
                        : 'Register Client & Generate Rollout Code \u2192'}
                    </button>
                  </div>
                </form>
              )}

              {setupStep === 3 && firstCreatedCompany && (
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--green)', marginBottom: 8 }}>
                    Workspace Ready — Windows AI App Rollout Kit
                  </h2>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-muted)',
                      marginBottom: 16,
                    }}
                  >
                    <strong>{firstCreatedCompany.name}</strong> is now active. Share this Company
                    Code with client staff or enter it during laptop enrollment:
                  </p>

                  <div className="rollout-box">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                          }}
                        >
                          ACTIVE COMPANY CODE
                        </span>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--green)',
                          }}
                        >
                          {firstCreatedCompany.company_code}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-green"
                        onClick={() =>
                          handleCopy(firstCreatedCompany.company_code, 'first-rollout-code')
                        }
                      >
                        {copiedKey === 'first-rollout-code'
                          ? 'Copied Company Code \u2713'
                          : 'Copy Company Code'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-green"
                    style={{ width: '100%' }}
                    onClick={() => setInFirstRunWizard(false)}
                  >
                    Launch Production CRM Command Center &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // UNAUTHENTICATED PRODUCTION SIGN-IN SCREEN
  // ============================================================================
  if (!authenticated || !currentUser) {
    return (
      <>
        <header className="crm-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" className="crm-brand">
              <img src="/logo-full-light.svg" alt="IT Department" />
            </a>
            <span className="crm-badge">Multi-Company Operations CRM</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            AUTHORIZED PERSONNEL ONLY
          </span>
        </header>

        <div className="auth-screen">
          <div className="auth-card">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                SIGN IN // IT DEPARTMENT NG
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                SLA DESK
              </span>
            </div>
            <div className="modal-body">
              <h1
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  color: 'var(--green)',
                  marginBottom: 6,
                }}
              >
                Operations Portal Sign In
              </h1>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: 20,
                }}
              >
                Sign in with your Super Manager or assigned IT Manager credentials.
              </p>

              {authError && <div className="error-banner">{authError}</div>}

              <form onSubmit={handleLogin}>
                <div className="field">
                  <label>Official Work Email *</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    placeholder="name@itdepartment.ng"
                  />
                </div>
                <div className="field">
                  <label>Password *</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-green"
                  style={{ width: '100%', marginTop: 6 }}
                  disabled={submitting}
                >
                  {submitting ? 'Authenticating...' : 'Sign In to Operations Desk \u2192'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // AUTHENTICATED PRODUCTION CRM WORKSPACE
  // ============================================================================
  return (
    <>
      {/* Top Command Bar */}
      <header className="crm-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" className="crm-brand">
            <img src="/logo-full-light.svg" alt="IT Department" />
          </a>
          <span className="crm-badge">Next.js Multi-Company CRM</span>
        </div>

        <div className="crm-role-switcher">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              {currentUser.name}{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  border: '1px solid rgba(255,255,255,0.4)',
                  marginLeft: 6,
                }}
              >
                {isSuperManager ? 'SUPER MANAGER' : 'IT MANAGER'}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.73rem',
                opacity: 0.8,
              }}
            >
              {currentUser.email}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleLogout}
            style={{ marginLeft: 8 }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="crm-shell">
        {/* Sidebar Navigation */}
        <aside className="crm-sidebar">
          <div>
            <span className="crm-nav-group-label">Operations Desk</span>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <span>01 / Command Center</span>
            </button>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'tickets' ? 'active' : ''}`}
              onClick={() => setActiveView('tickets')}
            >
              <span>02 / Support Tickets</span>
              <span className="nav-count">{openTicketsCount}</span>
            </button>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveView('devices')}
            >
              <span>03 / Enrolled Laptops</span>
              <span className="nav-count">{visibleDevices.length}</span>
            </button>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'fixes' ? 'active' : ''}`}
              onClick={() => setActiveView('fixes')}
            >
              <span>04 / 30-Fix Telemetry</span>
              <span className="nav-count">{visibleFixes.length}</span>
            </button>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'companies' ? 'active' : ''}`}
              onClick={() => setActiveView('companies')}
            >
              <span>05 / Client Companies</span>
              <span className="nav-count">{visibleCompanies.length}</span>
            </button>
            <button
              type="button"
              className={`crm-nav-btn ${activeView === 'hrweb' ? 'active' : ''}`}
              onClick={() => setActiveView('hrweb')}
            >
              <span>06 / HR &amp; Website Care</span>
              <span className="nav-count">
                {visibleHrWeb.filter((t) => t.status !== 'Completed').length}
              </span>
            </button>

            {isSuperManager && (
              <div style={{ marginTop: 22 }}>
                <span className="crm-nav-group-label">Super Manager Admin</span>
                <button
                  type="button"
                  className={`crm-nav-btn ${activeView === 'managers' ? 'active' : ''}`}
                  onClick={() => setActiveView('managers')}
                >
                  <span>07 / IT Managers &amp; Assign</span>
                  <span className="nav-count">{itManagers.length}</span>
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              padding: 20,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: 4 }}>
              WINDOWS APP SYNC
            </div>
            <div>
              Company Codes entered on staff laptops automatically route fix logs and tickets to the
              assigned IT Manager.
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="crm-main">
          <div className="crm-toolbar">
            <div>
              <h1 className="crm-page-title">
                {isSuperManager
                  ? 'Multi-Company Command Center'
                  : `IT Manager Desk \u2014 ${currentUser.name}`}
              </h1>
              <p className="crm-page-sub">
                {isSuperManager
                  ? 'Super Manager Mode \u2014 Full visibility across all client companies and IT Managers.'
                  : `Scoped IT Manager Workspace (${
                      currentUser.specialization || 'Endpoint & Network SLA'
                    }) \u2014 Showing only companies assigned to you.`}
              </p>
            </div>

            <div className="crm-filter-bar">
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Filter Company:</label>
              <select
                className="crm-select"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="ALL">All Assigned Companies ({scopedCompanies.length})</option>
                {scopedCompanies.map((c) => (
                  <option key={c.company_code} value={c.company_code}>
                    {c.name} ({c.company_code})
                  </option>
                ))}
              </select>

              {isSuperManager && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={openGuidedCompanyWizard}
                  >
                    + Onboard Client Company
                  </button>
                  <button
                    type="button"
                    className="btn btn-green btn-sm"
                    onClick={() => {
                      setAuthError('');
                      setShowManagerModal(true);
                    }}
                  >
                    + Create IT Manager
                  </button>
                </>
              )}
            </div>
          </div>

          {/* VIEW 1: OVERVIEW */}
          {activeView === 'overview' && (
            <section>
              <div className="kpi-grid">
                <div className="kpi-card dark">
                  <span className="kpi-label">Active Client Companies</span>
                  <span className="kpi-val">{visibleCompanies.length}</span>
                  <span className="kpi-sub">{formatNaira(totalRetainer)} / mo recurring SLA</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Enrolled Staff Laptops</span>
                  <span className="kpi-val">{visibleDevices.length}</span>
                  <span className="kpi-sub">Linked via Company Code</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Open Support Tickets</span>
                  <span className="kpi-val">{openTicketsCount}</span>
                  <span className="kpi-sub">Routed to Assigned IT Manager</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Automated AI Fixes Run</span>
                  <span className="kpi-val">{visibleFixes.length}</span>
                  <span className="kpi-sub">
                    {offlineFixesCount} executed 100% offline &amp; synced
                  </span>
                </div>
              </div>

              {isSuperManager && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      Super Manager View: IT Managers &amp; Assigned Companies
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={openGuidedCompanyWizard}
                      >
                        + Onboard New Client Company
                      </button>
                      <button
                        type="button"
                        className="btn btn-green btn-sm"
                        onClick={() => setActiveView('managers')}
                      >
                        Manage IT Managers &amp; Assignments &rarr;
                      </button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>IT Manager</th>
                          <th>Specialization</th>
                          <th>Assigned Client Companies</th>
                          <th>Enrolled PCs</th>
                          <th>Open Tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itManagers.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                              No internal IT Managers created yet. Click{' '}
                              <strong>+ Create IT Manager</strong> to add your first engineer.
                            </td>
                          </tr>
                        ) : (
                          itManagers.map((m) => {
                            const assigned = (state.companies || []).filter(
                              (c) => String(c.assigned_manager_id) === String(m.id)
                            );
                            const codes = new Set(assigned.map((c) => c.company_code));
                            const mDevs = (state.devices || []).filter((d) =>
                              codes.has(d.company_code)
                            );
                            const mOpen = (state.tickets || []).filter(
                              (t) => codes.has(t.company_code) && t.status !== 'Resolved'
                            );
                            return (
                              <tr key={m.id}>
                                <td>
                                  <strong>{m.name}</strong>
                                  <br />
                                  <span
                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                  >
                                    {m.email}
                                  </span>
                                </td>
                                <td>{m.specialization || m.specialty}</td>
                                <td>
                                  {assigned.length > 0 ? (
                                    assigned.map((c) => (
                                      <span
                                        key={c.company_code}
                                        className="code-pill"
                                        style={{ margin: 2 }}
                                      >
                                        {c.name} ({c.company_code})
                                      </span>
                                    ))
                                  ) : (
                                    <em>None assigned</em>
                                  )}
                                </td>
                                <td>
                                  <strong>{mDevs.length}</strong> PCs
                                </td>
                                <td>
                                  <strong>{mOpen.length}</strong> open
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                  gap: 24,
                }}
              >
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Active Escalated Tickets</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveView('tickets')}
                    >
                      Open Ticket Desk &rarr;
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Company &amp; Staff</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTickets.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ color: 'var(--text-muted)' }}>
                              No support tickets submitted from enrolled Windows PCs yet.
                            </td>
                          </tr>
                        ) : (
                          visibleTickets.slice(0, 5).map((t) => {
                            const comp = getCompanyByCode(t.company_code);
                            const pillClass =
                              t.status === 'Resolved'
                                ? 'resolved'
                                : t.status === 'open'
                                ? 'open'
                                : 'progress';
                            return (
                              <tr key={t.id || t.ticket_id}>
                                <td>
                                  <strong>#{t.id || t.ticket_id}</strong>
                                </td>
                                <td>
                                  <strong>{comp ? comp.name : t.company_code}</strong>
                                  <br />
                                  <span
                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                  >
                                    {t.name} &mdash; {(t.problem || '').slice(0, 55)}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-pill ${pillClass}`}>{t.status}</span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setEditingTicket({ ...t })}
                                  >
                                    Respond
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Latest Automated Fixes Run on Staff PCs</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveView('fixes')}
                    >
                      All Fix Logs &rarr;
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Company / User</th>
                          <th>Fix Executed</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFixes.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ color: 'var(--text-muted)' }}>
                              No automated 30-fix logs received yet.
                            </td>
                          </tr>
                        ) : (
                          visibleFixes.slice(0, 5).map((f) => (
                            <tr key={f.id}>
                              <td>
                                <strong>{f.company_code}</strong>
                                <br />
                                <span
                                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                >
                                  {f.employee_name || f.device_id}
                                </span>
                              </td>
                              <td>
                                <strong>{f.fix_title}</strong>
                                <br />
                                <span
                                  style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}
                                >
                                  {(f.output || '').slice(0, 60)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    f.mode === 'offline_synced' ? 'offline' : 'resolved'
                                  }`}
                                >
                                  {f.mode === 'offline_synced' ? 'OFFLINE SYNCED' : 'ONLINE'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 2: SUPPORT TICKETS */}
          {activeView === 'tickets' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="panel-title">
                    Unified Support Ticket &amp; Remote Takeover Desk
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Tickets sent from the Windows AI Support App arrive here with PC diagnostics,
                    chat history, and RustDesk Remote ID.
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID &amp; Time</th>
                      <th>Company &amp; Assigned IT Mgr</th>
                      <th>Employee &amp; Dept</th>
                      <th>Reported Issue &amp; Diagnostics</th>
                      <th>RustDesk Remote ID</th>
                      <th>Status &amp; In-App Reply</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ color: 'var(--text-muted)' }}>
                          No escalated tickets for your assigned companies.
                        </td>
                      </tr>
                    ) : (
                      visibleTickets.map((t) => {
                        const comp = getCompanyByCode(t.company_code);
                        const pillClass =
                          t.status === 'Resolved'
                            ? 'resolved'
                            : t.status === 'open'
                            ? 'open'
                            : 'progress';
                        const tid = t.id || t.ticket_id;
                        return (
                          <tr key={tid}>
                            <td>
                              <strong>#{tid}</strong>
                              <br />
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {(t.created || '').slice(0, 16).replace('T', ' ')}
                              </span>
                            </td>
                            <td>
                              <span className="code-pill">{t.company_code}</span>
                              <br />
                              <strong>{comp ? comp.name : 'Unlinked'}</strong>
                              <br />
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                IT Mgr: {getManagerName(t.assigned_manager_id)}
                              </span>
                            </td>
                            <td>
                              <strong>{t.name}</strong>
                              <br />
                              <span style={{ fontSize: '0.78rem' }}>
                                {t.department || 'General'}
                              </span>
                              <br />
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {t.phone}
                              </span>
                            </td>
                            <td style={{ maxWidth: 290 }}>
                              <strong>{t.problem}</strong>
                              <br />
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {t.sysinfo}
                              </span>
                            </td>
                            <td>
                              {t.remote_id ? (
                                <>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                    {t.remote_id}
                                  </span>
                                  <br />
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{ marginTop: 4 }}
                                    onClick={() => handleCopy(t.remote_id, `rd-${tid}`)}
                                  >
                                    {copiedKey === `rd-${tid}`
                                      ? 'Copied ID \u2713'
                                      : 'Connect RustDesk'}
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  Not attached
                                </span>
                              )}
                            </td>
                            <td style={{ maxWidth: 240 }}>
                              <span className={`status-pill ${pillClass}`}>{t.status}</span>
                              {t.manager_reply && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: '0.78rem',
                                    background: 'var(--offwhite)',
                                    padding: 6,
                                    borderLeft: '2px solid var(--green)',
                                  }}
                                >
                                  <strong>In-App Reply:</strong> {t.manager_reply}
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-green btn-sm"
                                onClick={() => setEditingTicket({ ...t })}
                              >
                                Update / Reply
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 3: ENROLLED LAPTOPS */}
          {activeView === 'devices' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="panel-title">
                    Enrolled Client Computers &amp; Staff Directory
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Every Windows laptop enrolled via an organisation&apos;s Company Code.
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company Code &amp; Name</th>
                      <th>Assigned IT Manager</th>
                      <th>Employee &amp; Department</th>
                      <th>System Specs (OS, RAM, Disk, Uptime)</th>
                      <th>Health Status</th>
                      <th>Instant Remote Desktop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevices.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                          No laptops enrolled yet. Enter a Company Code inside the Windows AI
                          Support App (⚙ Company Code) to enroll client PCs.
                        </td>
                      </tr>
                    ) : (
                      visibleDevices.map((d) => {
                        const comp = getCompanyByCode(d.company_code);
                        const isWarn = (d.health_status || '').toLowerCase().includes('warn');
                        return (
                          <tr key={d.device_id}>
                            <td>
                              <span className="code-pill">{d.company_code}</span>
                              <br />
                              <strong>{comp ? comp.name : 'Unlinked'}</strong>
                            </td>
                            <td>
                              <strong>
                                {comp ? getManagerName(comp.assigned_manager_id) : 'Unassigned'}
                              </strong>
                            </td>
                            <td>
                              <strong>{d.employee_name || 'Staff PC'}</strong>
                              <br />
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {d.department} • {d.phone}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.78rem',
                                maxWidth: 300,
                              }}
                            >
                              {d.sysinfo}
                            </td>
                            <td>
                              <span className={`status-pill ${isWarn ? 'progress' : 'resolved'}`}>
                                {d.health_status}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                ID: {d.remote_id || 'N/A'}
                              </span>
                              <br />
                              {d.remote_id && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ marginTop: 4 }}
                                  onClick={() => handleCopy(d.remote_id, `dev-${d.device_id}`)}
                                >
                                  {copiedKey === `dev-${d.device_id}`
                                    ? 'Copied ID \u2713'
                                    : 'Instant Remote Desktop'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 4: 30-FIX TELEMETRY */}
          {activeView === 'fixes' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="panel-title">
                    Automated Fix Execution History (Online &amp; Offline Synced)
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Every time an employee runs any of the 30 fixes in the Windows app, the result
                    is logged here.
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Company</th>
                      <th>Employee &amp; Device</th>
                      <th>Fix Executed</th>
                      <th>Execution Mode</th>
                      <th>Diagnostic Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFixes.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                          No automated fix telemetry recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visibleFixes.map((f) => {
                        const comp = getCompanyByCode(f.company_code);
                        return (
                          <tr key={f.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                              {(f.created_at || '').slice(0, 19).replace('T', ' ')}
                            </td>
                            <td>
                              <span className="code-pill">{f.company_code}</span>
                              <br />
                              <span style={{ fontSize: '0.78rem' }}>{comp ? comp.name : ''}</span>
                            </td>
                            <td>
                              <strong>{f.employee_name || f.device_id}</strong>
                              <br />
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.73rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {f.device_id}
                              </span>
                            </td>
                            <td>
                              <strong>{f.fix_title}</strong>
                              <br />
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.73rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {f.fix_id} • {f.category}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`status-pill ${
                                  f.mode === 'offline_synced' ? 'offline' : 'resolved'
                                }`}
                              >
                                {f.mode === 'offline_synced' ? '100% OFFLINE (SYNCED)' : 'ONLINE'}
                              </span>
                            </td>
                            <td style={{ maxWidth: 320, fontSize: '0.82rem' }}>{f.output}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 5: CLIENT COMPANIES */}
          {activeView === 'companies' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="panel-title">
                    Client Organisations, Company Codes &amp; Assigned IT Managers
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Give each client their Company Code to enter once on their Windows AI Support
                    App.
                  </p>
                </div>
                {isSuperManager && (
                  <button
                    type="button"
                    className="btn btn-green btn-sm"
                    onClick={openGuidedCompanyWizard}
                  >
                    + Onboard Client Company
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company Code (For Windows App)</th>
                      <th>Organisation &amp; Plan</th>
                      <th>Assigned IT Manager</th>
                      <th>CEO / HR / Admin Contacts</th>
                      <th>Enrolled PCs &amp; Visits</th>
                      <th>Website &amp; SSL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                          No client companies assigned yet.
                        </td>
                      </tr>
                    ) : (
                      visibleCompanies.map((c) => {
                        const compDevs = (state.devices || []).filter(
                          (d) => d.company_code === c.company_code
                        ).length;
                        return (
                          <tr key={c.company_code}>
                            <td>
                              <span className="code-pill">{c.company_code}</span>
                              <br />
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ marginTop: 6 }}
                                onClick={() => handleCopy(c.company_code, `code-${c.company_code}`)}
                              >
                                {copiedKey === `code-${c.company_code}`
                                  ? 'Copied \u2713'
                                  : 'Copy App Code'}
                              </button>
                            </td>
                            <td>
                              <strong style={{ fontSize: '0.96rem' }}>{c.name}</strong>
                              <br />
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {c.industry}
                              </span>
                              <br />
                              <span className="status-pill resolved" style={{ marginTop: 4 }}>
                                {c.plan_tier || c.plan} (
                                {formatNaira(c.monthly_retainer ?? c.retainer_ngn)}/mo)
                              </span>
                            </td>
                            <td>
                              <strong>{getManagerName(c.assigned_manager_id)}</strong>
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>
                              <div>
                                <strong>CEO:</strong> {c.ceo_contact || '—'}
                              </div>
                              <div>
                                <strong>HR:</strong> {c.hr_contact || '—'}
                              </div>
                              <div>
                                <strong>Admin:</strong> {c.admin_contact || '—'}
                              </div>
                            </td>
                            <td>
                              <strong>
                                {compDevs} / {c.max_pcs || 40} PCs
                              </strong>{' '}
                              enrolled
                              <br />
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                On-Site Visits: {c.onsite_visits_used || 0} of{' '}
                                {c.onsite_visits_quota || 3} used
                              </span>
                            </td>
                            <td>
                              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                {c.domain_name || 'N/A'}
                              </strong>
                              <br />
                              <span className="status-pill resolved">
                                {c.ssl_status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 6: HR & WEBSITE CARE */}
          {activeView === 'hrweb' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="panel-title">
                    HR Staff Onboarding / 15-Min Exit Lockout &amp; Corporate Website Care
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-green btn-sm"
                  onClick={() => {
                    setHrWebForm((prev) => ({
                      ...prev,
                      company_code: scopedCompanies[0]?.company_code || '',
                    }));
                    setShowHrWebModal(true);
                  }}
                >
                  + Log HR or Website Task
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Category</th>
                      <th>Task Deliverable</th>
                      <th>Requested By</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHrWeb.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                          No HR onboarding, exit lockout, or website care tasks logged yet.
                        </td>
                      </tr>
                    ) : (
                      visibleHrWeb.map((task) => {
                        const comp = getCompanyByCode(task.company_code);
                        const done = task.status === 'Completed' || task.status === 'completed';
                        return (
                          <tr key={task.id}>
                            <td>
                              <span className="code-pill">{task.company_code}</span>
                              <br />
                              <strong>{comp ? comp.name : ''}</strong>
                            </td>
                            <td>
                              <strong>{task.task_type}</strong>
                            </td>
                            <td>{task.title}</td>
                            <td>{task.requested_by || 'Client HR/Admin'}</td>
                            <td>
                              <span className={`status-pill ${done ? 'resolved' : 'progress'}`}>
                                {task.status}
                              </span>
                            </td>
                            <td>
                              {done ? (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  Done &checkmark;
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleCompleteTask(task.id)}
                                >
                                  Mark Completed
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 7: SUPER MANAGER — IT MANAGERS & COMPANY ASSIGNMENT */}
          {activeView === 'managers' && isSuperManager && (
            <section>
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-title">
                      Super Manager: IT Manager Accounts &amp; Company Assignment
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Create accounts for your internal IT Managers and assign specific client
                      companies to each IT Manager.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-green btn-sm"
                    onClick={() => {
                      setAuthError('');
                      setShowManagerModal(true);
                    }}
                  >
                    + Create New IT Manager Account
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID &amp; Name</th>
                        <th>Login Email &amp; Phone</th>
                        <th>Role &amp; Specialization</th>
                        <th>Assigned Client Companies</th>
                        <th>Workload Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.managers || []).map((m) => {
                        const assigned = (state.companies || []).filter(
                          (c) => String(c.assigned_manager_id) === String(m.id)
                        );
                        return (
                          <tr key={m.id}>
                            <td>
                              <strong>
                                {m.id} &mdash; {m.name}
                              </strong>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                {m.email}
                              </span>
                              <br />
                              {m.phone}
                            </td>
                            <td>
                              <span
                                className={`status-pill ${
                                  m.role === 'super_manager' ? 'offline' : 'resolved'
                                }`}
                              >
                                {m.role.toUpperCase()}
                              </span>
                              <br />
                              <span style={{ fontSize: '0.78rem' }}>
                                {m.specialization || m.specialty}
                              </span>
                            </td>
                            <td>
                              {assigned.length > 0 ? (
                                assigned.map((c) => (
                                  <span
                                    key={c.company_code}
                                    className="code-pill"
                                    style={{ margin: 2 }}
                                  >
                                    {c.name}
                                  </span>
                                ))
                              ) : (
                                <em>No companies assigned</em>
                              )}
                            </td>
                            <td>{assigned.length} companies</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    Quick Company-to-IT-Manager Assignment Matrix
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Company Code</th>
                        <th>Client Organisation</th>
                        <th>SLA Plan</th>
                        <th>Currently Assigned IT Manager</th>
                        <th>Reassign IT Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.companies || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                            No client companies onboarded yet.
                          </td>
                        </tr>
                      ) : (
                        (state.companies || []).map((c) => (
                          <tr key={c.company_code}>
                            <td>
                              <span className="code-pill">{c.company_code}</span>
                            </td>
                            <td>
                              <strong>{c.name}</strong>
                            </td>
                            <td>{c.plan_tier || c.plan}</td>
                            <td>
                              <strong>{getManagerName(c.assigned_manager_id)}</strong>
                            </td>
                            <td>
                              <select
                                className="crm-select"
                                value={c.assigned_manager_id || ''}
                                onChange={(e) =>
                                  handleReassignCompany(c.company_code, e.target.value)
                                }
                              >
                                {assignableManagers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.email})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODAL 1: CREATE IT MANAGER */}
      {showManagerModal && (
        <div className="modal-backdrop">
          <div className="crm-modal-box">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                CREATE NEW IT MANAGER ACCOUNT
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => setShowManagerModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {authError && <div className="error-banner">{authError}</div>}
              <form onSubmit={handleCreateManager}>
                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>IT Manager Full Name *</label>
                    <input
                      type="text"
                      required
                      value={mgrForm.name}
                      onChange={(e) => setMgrForm({ ...mgrForm, name: e.target.value })}
                      placeholder="e.g. Segun Adeyemi"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Official Login Email *</label>
                    <input
                      type="email"
                      required
                      value={mgrForm.email}
                      onChange={(e) => setMgrForm({ ...mgrForm, email: e.target.value })}
                      placeholder="segun@itdepartment.ng"
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={mgrForm.phone}
                      onChange={(e) => setMgrForm({ ...mgrForm, phone: e.target.value })}
                      placeholder="0803 000 0000"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Specialization</label>
                    <input
                      type="text"
                      value={mgrForm.specialization}
                      onChange={(e) => setMgrForm({ ...mgrForm, specialization: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Login Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={mgrForm.password}
                    onChange={(e) => setMgrForm({ ...mgrForm, password: e.target.value })}
                    placeholder="Set password for this IT Manager"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-green"
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  {submitting ? 'Creating Account...' : 'Create IT Manager Account \u2192'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* FLOW B: GUIDED 3-STEP "ONBOARD NEW CLIENT COMPANY" WIZARD */}
      {showCompanyWizard && (
        <div className="modal-backdrop">
          <div className="wizard-card">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                ONBOARD NEW CLIENT COMPANY // STEP {companyWizardStep} OF 3
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => setShowCompanyWizard(false)}
              >
                &times;
              </button>
            </div>

            <div className="wizard-steps">
              <div
                className={`wizard-step-tab ${
                  companyWizardStep === 1 ? 'active' : companyWizardStep > 1 ? 'done' : ''
                }`}
              >
                01 / Profile &amp; SLA Plan
              </div>
              <div
                className={`wizard-step-tab ${
                  companyWizardStep === 2 ? 'active' : companyWizardStep > 2 ? 'done' : ''
                }`}
              >
                02 / IT Manager &amp; Contacts
              </div>
              <div className={`wizard-step-tab ${companyWizardStep === 3 ? 'active' : ''}`}>
                03 / Windows Rollout Kit
              </div>
            </div>

            <div className="modal-body">
              {authError && <div className="error-banner">{authError}</div>}

              {companyWizardStep === 1 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setCompanyWizardStep(2);
                  }}
                >
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--green)', marginBottom: 12 }}>
                    Step 1: Company Profile &amp; Retainer Plan
                  </h3>
                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Company Name *</label>
                      <input
                        type="text"
                        required
                        value={compForm.name}
                        onChange={(e) => {
                          const nameVal = e.target.value;
                          setCompForm({
                            ...compForm,
                            name: nameVal,
                            company_code: generateCompanyCode(nameVal, state.companies.length),
                          });
                        }}
                        placeholder="e.g. Sterling Marine Ltd"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Industry *</label>
                      <input
                        type="text"
                        required
                        value={compForm.industry}
                        onChange={(e) => setCompForm({ ...compForm, industry: e.target.value })}
                        placeholder="e.g. Logistics, Healthcare, Legal, Finance"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Retainer Plan Tier *</label>
                      <select
                        value={compForm.plan_tier}
                        onChange={(e) => {
                          const tier = e.target.value;
                          const preset = PLAN_PRICES[tier] || { retainer: 300000, max_pcs: 40 };
                          setCompForm({
                            ...compForm,
                            plan_tier: tier,
                            monthly_retainer: preset.retainer,
                            max_pcs: preset.max_pcs,
                          });
                        }}
                      >
                        <option value="Starter Office SLA">
                          Starter Office SLA (₦150,000/mo)
                        </option>
                        <option value="Growth Department SLA">
                          Growth Department SLA (₦300,000/mo)
                        </option>
                        <option value="Enterprise Managed SLA">
                          Enterprise Managed SLA (₦550,000/mo)
                        </option>
                        <option value="7-Day Free Office Pilot">
                          7-Day Free Office Pilot (₦0)
                        </option>
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Monthly Retainer (NGN) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={compForm.monthly_retainer}
                        onChange={(e) =>
                          setCompForm({
                            ...compForm,
                            monthly_retainer: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Max Enrolled PCs *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={compForm.max_pcs}
                        onChange={(e) =>
                          setCompForm({ ...compForm, max_pcs: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Corporate Domain Name</label>
                      <input
                        type="text"
                        value={compForm.domain_name}
                        onChange={(e) =>
                          setCompForm({ ...compForm, domain_name: e.target.value })
                        }
                        placeholder="sterlingmarine.ng"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-green" style={{ width: '100%' }}>
                    Next: IT Manager Assignment &amp; Stakeholders &rarr;
                  </button>
                </form>
              )}

              {companyWizardStep === 2 && (
                <form onSubmit={handleCreateCompanyWizardSubmit}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--green)', marginBottom: 12 }}>
                    Step 2: IT Manager Assignment &amp; Stakeholders
                  </h3>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Assigned Dedicated IT Manager *</label>
                      <select
                        required
                        value={compForm.assigned_manager_id}
                        onChange={(e) =>
                          setCompForm({ ...compForm, assigned_manager_id: e.target.value })
                        }
                      >
                        {assignableManagers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role === 'super_manager' ? 'Super Manager' : 'IT Manager'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Generated Company Code *</label>
                      <input
                        type="text"
                        required
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        value={compForm.company_code}
                        onChange={(e) =>
                          setCompForm({
                            ...compForm,
                            company_code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>CEO / Managing Director Contact</label>
                      <input
                        type="text"
                        value={compForm.ceo_contact}
                        onChange={(e) =>
                          setCompForm({ ...compForm, ceo_contact: e.target.value })
                        }
                        placeholder="Name & Phone / Email"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>HR Manager Contact</label>
                      <input
                        type="text"
                        value={compForm.hr_contact}
                        onChange={(e) =>
                          setCompForm({ ...compForm, hr_contact: e.target.value })
                        }
                        placeholder="HR Head Name & Phone"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Admin / Facility Manager Contact</label>
                    <input
                      type="text"
                      value={compForm.admin_contact}
                      onChange={(e) =>
                        setCompForm({ ...compForm, admin_contact: e.target.value })
                      }
                      placeholder="Admin Manager Name & Phone"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setCompanyWizardStep(1)}
                    >
                      &larr; Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-green"
                      style={{ flex: 2 }}
                      disabled={submitting}
                    >
                      {submitting
                        ? 'Activating Client Company...'
                        : 'Create Company & Generate Rollout Kit \u2192'}
                    </button>
                  </div>
                </form>
              )}

              {companyWizardStep === 3 && onboardedCompanyResult && (
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--green)', marginBottom: 8 }}>
                    Step 3: Windows AI App Rollout Kit
                  </h3>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: 16,
                    }}
                  >
                    <strong>{onboardedCompanyResult.name}</strong> has been registered and assigned
                    to <strong>{getManagerName(onboardedCompanyResult.assigned_manager_id)}</strong>
                    .
                  </p>

                  <div className="rollout-box">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                          }}
                        >
                          UNIQUE COMPANY CODE (WINDOWS AI SUPPORT APP)
                        </span>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '1.6rem',
                            fontWeight: 700,
                            color: 'var(--green)',
                          }}
                        >
                          {onboardedCompanyResult.company_code}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-green"
                        onClick={() =>
                          handleCopy(onboardedCompanyResult.company_code, 'wizard-company-code')
                        }
                      >
                        {copiedKey === 'wizard-company-code'
                          ? 'Copied Company Code \u2713'
                          : '1-Click Copy Code'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid var(--border)',
                      padding: 16,
                      marginBottom: 18,
                      fontSize: '0.84rem',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--green)',
                        marginBottom: 8,
                      }}
                    >
                      CLIENT LAPTOP ENROLLMENT CHECKLIST:
                    </div>
                    <ol style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
                      <li>
                        Install &amp; launch the <strong>IT Department Windows AI Support App</strong>{' '}
                        on each staff laptop.
                      </li>
                      <li>
                        Click the <strong>⚙ Company Code</strong> button in the top bar of the
                        Windows app.
                      </li>
                      <li>
                        Paste{' '}
                        <span className="code-pill">{onboardedCompanyResult.company_code}</span>{' '}
                        along with the employee&apos;s name, department, and RustDesk ID.
                      </li>
                      <li>
                        All 30 automated fixes (online &amp; offline) and support tickets will now
                        sync directly to{' '}
                        <strong>{getManagerName(onboardedCompanyResult.assigned_manager_id)}</strong>
                        .
                      </li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    className="btn btn-green"
                    style={{ width: '100%' }}
                    onClick={() => setShowCompanyWizard(false)}
                  >
                    Done &mdash; Return to Command Center
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT TICKET & SEND IN-APP REPLY */}
      {editingTicket && (
        <div className="modal-backdrop">
          <div className="crm-modal-box">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                TICKET #{editingTicket.id || editingTicket.ticket_id} //{' '}
                {editingTicket.company_code}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => setEditingTicket(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveTicket}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--offwhite)',
                    border: '1px solid var(--border)',
                    fontSize: '0.84rem',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <strong>Employee:</strong> {editingTicket.name} ({editingTicket.department})
                    &mdash; {editingTicket.phone}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong>Issue:</strong> {editingTicket.problem}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.76rem',
                    }}
                  >
                    <strong>RustDesk Remote ID:</strong> {editingTicket.remote_id || 'N/A'} |{' '}
                    <strong>PC:</strong> {editingTicket.sysinfo}
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Ticket Status</label>
                    <select
                      value={editingTicket.status}
                      onChange={(e) =>
                        setEditingTicket({ ...editingTicket, status: e.target.value })
                      }
                    >
                      <option value="open">open</option>
                      <option value="In Progress (Remote)">In Progress (Remote Desktop)</option>
                      <option value="On-Site Dispatched">On-Site Engineer Dispatched</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Assigned IT Manager</label>
                    <select
                      value={editingTicket.assigned_manager_id || ''}
                      onChange={(e) =>
                        setEditingTicket({
                          ...editingTicket,
                          assigned_manager_id: e.target.value,
                        })
                      }
                    >
                      {assignableManagers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Direct Reply to Employee&apos;s Windows App</label>
                  <textarea
                    rows={3}
                    value={editingTicket.manager_reply || ''}
                    onChange={(e) =>
                      setEditingTicket({ ...editingTicket, manager_reply: e.target.value })
                    }
                    placeholder="e.g. Connecting to your PC via RustDesk now..."
                  />
                </div>

                <button type="submit" className="btn btn-green" style={{ width: '100%' }}>
                  Save &amp; Push Update to Employee&apos;s Windows App &rarr;
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE HR / WEBSITE TASK */}
      {showHrWebModal && (
        <div className="modal-backdrop">
          <div className="crm-modal-box">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                LOG HR OR CORPORATE WEBSITE TASK
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => setShowHrWebModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateHrWebTask}>
                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Client Company *</label>
                    <select
                      required
                      value={hrWebForm.company_code}
                      onChange={(e) =>
                        setHrWebForm({ ...hrWebForm, company_code: e.target.value })
                      }
                    >
                      {scopedCompanies.map((c) => (
                        <option key={c.company_code} value={c.company_code}>
                          {c.name} ({c.company_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Task Category *</label>
                    <select
                      value={hrWebForm.task_type}
                      onChange={(e) => setHrWebForm({ ...hrWebForm, task_type: e.target.value })}
                    >
                      <option value="HR Onboarding">HR New-Hire Laptop &amp; Email Setup</option>
                      <option value="HR Exit Lockout">HR 15-Min Staff Exit Lockout</option>
                      <option value="Website Update">Corporate Website Content Update</option>
                      <option value="Domain & SSL Care">Domain Renewal / SSL Check</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Deliverable Description *</label>
                  <input
                    type="text"
                    required
                    value={hrWebForm.title}
                    onChange={(e) => setHrWebForm({ ...hrWebForm, title: e.target.value })}
                    placeholder="e.g. Create @company.ng email and enroll laptop for new Accountant"
                  />
                </div>
                <div className="field">
                  <label>Requested By (CEO / HR / Admin)</label>
                  <input
                    type="text"
                    value={hrWebForm.requested_by}
                    onChange={(e) => setHrWebForm({ ...hrWebForm, requested_by: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-green" style={{ width: '100%' }}>
                  Save Task &rarr;
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
