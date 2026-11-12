'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { INITIAL_CRM_DATA } from '@/data/seedData';

const STORAGE_KEY = 'itdept_crm_state_v1';
const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8080';

function formatNaira(amount) {
  return '\u20A6' + Number(amount || 0).toLocaleString('en-NG');
}

export default function CRMPlatformPage() {
  const [state, setState] = useState(INITIAL_CRM_DATA);
  const [activeManagerId, setActiveManagerId] = useState(1); // 1 = Super Manager
  const [activeView, setActiveView] = useState('overview');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [copiedKey, setCopiedKey] = useState('');

  // Modal states
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showHrWebModal, setShowHrWebModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);

  // Form states
  const [mgrForm, setMgrForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: 'Systems, Network & Endpoint Lead',
    password: 'itdept123',
  });

  const [compForm, setCompForm] = useState({
    name: '',
    company_code: '',
    plan_tier: 'Growth Department SLA',
    monthly_retainer: 300000,
    max_pcs: 40,
    assigned_manager_id: 2,
    ceo_contact: '',
    hr_contact: '',
    domain_name: '',
  });

  const [hrWebForm, setHrWebForm] = useState({
    company_code: 'ITD-NEXUS-01',
    task_type: 'HR Onboarding',
    title: '',
    requested_by: '',
  });

  // Hydrate from localStorage + FastAPI backend on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.managers)) {
          setState(parsed);
        }
      }
    } catch (e) {}

    async function fetchLive() {
      try {
        const res = await fetch(`${FASTAPI_URL}/api/crm/bootstrap`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.managers)) {
            setState(data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          }
        }
      } catch (e) {}
    }
    fetchLive();
  }, []);

  const persistState = (nextState) => {
    setState(nextState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {}
  };

  const activeUser = useMemo(() => {
    return state.managers.find((m) => Number(m.id) === Number(activeManagerId)) || state.managers[0];
  }, [state.managers, activeManagerId]);

  const isSuperManager = activeUser?.role === 'super_manager';

  const itManagers = useMemo(() => {
    return state.managers.filter((m) => m.role === 'it_manager');
  }, [state.managers]);

  const scopedCompanies = useMemo(() => {
    if (isSuperManager) return state.companies;
    return state.companies.filter((c) => Number(c.assigned_manager_id) === Number(activeUser.id));
  }, [state.companies, isSuperManager, activeUser]);

  const visibleCompanyCodes = useMemo(() => {
    if (companyFilter !== 'ALL' && scopedCompanies.some((c) => c.company_code === companyFilter)) {
      return new Set([companyFilter]);
    }
    return new Set(scopedCompanies.map((c) => c.company_code));
  }, [scopedCompanies, companyFilter]);

  const visibleCompanies = useMemo(
    () => scopedCompanies.filter((c) => visibleCompanyCodes.has(c.company_code)),
    [scopedCompanies, visibleCompanyCodes]
  );
  const visibleDevices = useMemo(
    () => state.devices.filter((d) => visibleCompanyCodes.has(d.company_code)),
    [state.devices, visibleCompanyCodes]
  );
  const visibleFixes = useMemo(
    () => state.fix_logs.filter((f) => visibleCompanyCodes.has(f.company_code)),
    [state.fix_logs, visibleCompanyCodes]
  );
  const visibleTickets = useMemo(
    () => state.tickets.filter((t) => visibleCompanyCodes.has(t.company_code)),
    [state.tickets, visibleCompanyCodes]
  );
  const visibleHrWeb = useMemo(
    () => state.hr_web_tasks.filter((t) => visibleCompanyCodes.has(t.company_code)),
    [state.hr_web_tasks, visibleCompanyCodes]
  );

  const openTicketsCount = useMemo(
    () => visibleTickets.filter((t) => t.status !== 'Resolved').length,
    [visibleTickets]
  );

  const getManagerName = (mgrId) => {
    const found = state.managers.find((m) => Number(m.id) === Number(mgrId));
    return found ? found.name : 'Unassigned';
  };

  const getCompanyByCode = (code) => {
    return state.companies.find((c) => c.company_code === code);
  };

  const handleCopy = (text, key) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Super Manager: Reassign company to a different IT Manager
  const handleReassignCompany = async (companyCode, newManagerId) => {
    const mgrIdNum = Number(newManagerId);
    const nextCompanies = state.companies.map((c) =>
      c.company_code === companyCode ? { ...c, assigned_manager_id: mgrIdNum } : c
    );
    const nextTickets = state.tickets.map((t) =>
      t.company_code === companyCode && t.status !== 'Resolved'
        ? { ...t, assigned_manager_id: mgrIdNum }
        : t
    );
    persistState({ ...state, companies: nextCompanies, tickets: nextTickets });
    try {
      await fetch(`${FASTAPI_URL}/api/crm/companies/${companyCode}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_manager_id: mgrIdNum }),
      });
    } catch (e) {}
  };

  // Super Manager: Create new IT Manager account
  const handleCreateManager = async (e) => {
    e.preventDefault();
    const newMgr = {
      id: state.managers.length + 1,
      role: 'it_manager',
      ...mgrForm,
    };
    try {
      const res = await fetch(`${FASTAPI_URL}/api/crm/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mgrForm),
      });
      if (res.ok) {
        const saved = await res.json();
        newMgr.id = saved.id;
      }
    } catch (err) {}
    persistState({ ...state, managers: [...state.managers, newMgr] });
    setMgrForm({
      name: '',
      email: '',
      phone: '',
      specialization: 'Systems, Network & Endpoint Lead',
      password: 'itdept123',
    });
    setShowManagerModal(false);
  };

  // Super Manager: Create new Client Company
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    const payload = {
      ...compForm,
      company_code: compForm.company_code.trim().toUpperCase(),
      industry: 'Corporate B2B',
      admin_contact: compForm.hr_contact,
      assigned_manager_id: Number(compForm.assigned_manager_id),
    };
    const newComp = {
      id: state.companies.length + 1,
      onsite_visits_used: 0,
      onsite_visits_quota: 3,
      ssl_status: 'Active (Valid)',
      ...payload,
    };
    try {
      await fetch(`${FASTAPI_URL}/api/crm/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {}
    persistState({ ...state, companies: [...state.companies, newComp] });
    setShowCompanyModal(false);
  };

  // Update Support Ticket & Push In-App Reply to Employee's Windows App
  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!editingTicket) return;
    const nextTickets = state.tickets.map((t) =>
      t.id === editingTicket.id ? { ...editingTicket } : t
    );
    persistState({ ...state, tickets: nextTickets });
    try {
      await fetch(`${FASTAPI_URL}/api/crm/tickets/${editingTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editingTicket.status,
          manager_reply: editingTicket.manager_reply,
          assigned_manager_id: Number(editingTicket.assigned_manager_id),
        }),
      });
    } catch (err) {}
    setEditingTicket(null);
  };

  // Add HR / Website Task
  const handleCreateHrWebTask = async (e) => {
    e.preventDefault();
    const newTask = {
      id: Date.now(),
      status: 'Pending',
      created_at: new Date().toISOString(),
      ...hrWebForm,
    };
    persistState({ ...state, hr_web_tasks: [newTask, ...state.hr_web_tasks] });
    try {
      await fetch(`${FASTAPI_URL}/api/crm/hr-web-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hrWebForm),
      });
    } catch (err) {}
    setShowHrWebModal(false);
  };

  const handleCompleteTask = async (taskId) => {
    const nextTasks = state.hr_web_tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'Completed' } : t
    );
    persistState({ ...state, hr_web_tasks: nextTasks });
    try {
      await fetch(`${FASTAPI_URL}/api/crm/hr-web-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' }),
      });
    } catch (err) {}
  };

  const totalRetainer = visibleCompanies.reduce(
    (sum, c) => sum + (Number(c.monthly_retainer) || 0),
    0
  );
  const offlineFixesCount = visibleFixes.filter((f) => f.mode === 'offline_synced').length;

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
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Logged in as:</span>
          <select
            className="crm-role-select"
            value={activeManagerId}
            onChange={(e) => {
              const nextId = Number(e.target.value);
              setActiveManagerId(nextId);
              setCompanyFilter('ALL');
              const picked = state.managers.find((m) => Number(m.id) === nextId);
              if (picked?.role !== 'super_manager' && activeView === 'managers') {
                setActiveView('overview');
              }
            }}
          >
            {state.managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.role === 'super_manager' ? '👑 Super Manager: ' : '🛠️ IT Manager: '}
                {m.name}
              </option>
            ))}
          </select>
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
                  : `IT Manager Desk — ${activeUser.name}`}
              </h1>
              <p className="crm-page-sub">
                {isSuperManager
                  ? 'Super Manager Mode — Full visibility across all client companies and IT Managers.'
                  : `Scoped IT Manager Workspace (${activeUser.specialization}) — Showing only companies assigned to you.`}
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
                    onClick={() => setShowCompanyModal(true)}
                  >
                    + Add Company
                  </button>
                  <button
                    type="button"
                    className="btn btn-green btn-sm"
                    onClick={() => setShowManagerModal(true)}
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
                      👑 Super Manager View: IT Managers &amp; Assigned Companies
                    </span>
                    <button
                      type="button"
                      className="btn btn-green btn-sm"
                      onClick={() => setActiveView('managers')}
                    >
                      Manage IT Managers &amp; Assignments &rarr;
                    </button>
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
                        {itManagers.map((m) => {
                          const assigned = state.companies.filter(
                            (c) => Number(c.assigned_manager_id) === Number(m.id)
                          );
                          const codes = new Set(assigned.map((c) => c.company_code));
                          const mDevs = state.devices.filter((d) => codes.has(d.company_code));
                          const mOpen = state.tickets.filter(
                            (t) => codes.has(t.company_code) && t.status !== 'Resolved'
                          );
                          return (
                            <tr key={m.id}>
                              <td>
                                <strong>{m.name}</strong>
                                <br />
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {m.email}
                                </span>
                              </td>
                              <td>{m.specialization}</td>
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
                        })}
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
                        {visibleTickets.slice(0, 5).map((t) => {
                          const comp = getCompanyByCode(t.company_code);
                          const pillClass =
                            t.status === 'Resolved'
                              ? 'resolved'
                              : t.status === 'open'
                              ? 'open'
                              : 'progress';
                          return (
                            <tr key={t.id}>
                              <td>
                                <strong>#{t.id}</strong>
                              </td>
                              <td>
                                <strong>{comp ? comp.name : t.company_code}</strong>
                                <br />
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {t.name} — {t.problem.slice(0, 55)}...
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
                        })}
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
                        {visibleFixes.slice(0, 5).map((f) => (
                          <tr key={f.id}>
                            <td>
                              <strong>{f.company_code}</strong>
                              <br />
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {f.employee_name || f.device_id}
                              </span>
                            </td>
                            <td>
                              <strong>{f.fix_title}</strong>
                              <br />
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {f.output.slice(0, 60)}
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
                        ))}
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
                    {visibleTickets.map((t) => {
                      const comp = getCompanyByCode(t.company_code);
                      const pillClass =
                        t.status === 'Resolved'
                          ? 'resolved'
                          : t.status === 'open'
                          ? 'open'
                          : 'progress';
                      return (
                        <tr key={t.id}>
                          <td>
                            <strong>#{t.id}</strong>
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
                            <span style={{ fontSize: '0.78rem' }}>{t.department || 'General'}</span>
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
                                  onClick={() => handleCopy(t.remote_id, `rd-${t.id}`)}
                                >
                                  {copiedKey === `rd-${t.id}`
                                    ? 'Copied ID ✓'
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
                    })}
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
                    {visibleDevices.map((d) => {
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
                                  ? 'Copied ID ✓'
                                  : 'Instant Remote Desktop'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                    {visibleFixes.map((f) => {
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
                    })}
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
                    onClick={() => setShowCompanyModal(true)}
                  >
                    + Add Client Company
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
                    {visibleCompanies.map((c) => {
                      const compDevs = state.devices.filter(
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
                                ? 'Copied ✓'
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
                              {c.plan_tier} ({formatNaira(c.monthly_retainer)}/mo)
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
                              {compDevs} / {c.max_pcs} PCs
                            </strong>{' '}
                            enrolled
                            <br />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              On-Site Visits: {c.onsite_visits_used} of {c.onsite_visits_quota} used
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
                    })}
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
                  onClick={() => setShowHrWebModal(true)}
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
                    {visibleHrWeb.map((task) => {
                      const comp = getCompanyByCode(task.company_code);
                      const done = task.status === 'Completed';
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
                                Done ✓
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
                    })}
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
                      👑 Super Manager: IT Manager Accounts &amp; Company Assignment
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Create accounts for your internal IT Managers and assign specific client
                      companies to each IT Manager.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-green btn-sm"
                    onClick={() => setShowManagerModal(true)}
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
                      {state.managers.map((m) => {
                        const assigned = state.companies.filter(
                          (c) => Number(c.assigned_manager_id) === Number(m.id)
                        );
                        return (
                          <tr key={m.id}>
                            <td>
                              <strong>
                                #{m.id} — {m.name}
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
                              <span style={{ fontSize: '0.78rem' }}>{m.specialization}</span>
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
                      {state.companies.map((c) => (
                        <tr key={c.company_code}>
                          <td>
                            <span className="code-pill">{c.company_code}</span>
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                          </td>
                          <td>{c.plan_tier}</td>
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
                              {itManagers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.email})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
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
                  <label>Temporary Login Password *</label>
                  <input
                    type="text"
                    required
                    value={mgrForm.password}
                    onChange={(e) => setMgrForm({ ...mgrForm, password: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-green" style={{ width: '100%' }}>
                  Create IT Manager Account &rarr;
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE CLIENT COMPANY */}
      {showCompanyModal && (
        <div className="modal-backdrop">
          <div className="crm-modal-box">
            <div className="modal-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                ONBOARD NEW CLIENT ORGANISATION
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => setShowCompanyModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateCompany}>
                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Organisation Name *</label>
                    <input
                      type="text"
                      required
                      value={compForm.name}
                      onChange={(e) => {
                        const nameVal = e.target.value;
                        const slug = nameVal
                          .trim()
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 6);
                        const num = String(state.companies.length + 1).padStart(2, '0');
                        setCompForm({
                          ...compForm,
                          name: nameVal,
                          company_code: slug ? `ITD-${slug}-${num}` : compForm.company_code,
                        });
                      }}
                      placeholder="e.g. Sterling Marine Ltd"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Company Code (for Windows App) *</label>
                    <input
                      type="text"
                      required
                      value={compForm.company_code}
                      onChange={(e) => setCompForm({ ...compForm, company_code: e.target.value })}
                      placeholder="ITD-STERLING-05"
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>SLA Retainer Tier</label>
                    <select
                      value={compForm.plan_tier}
                      onChange={(e) => {
                        const tier = e.target.value;
                        const priceMap = {
                          'Starter Office SLA': 150000,
                          'Growth Department SLA': 300000,
                          'Enterprise Managed SLA': 550000,
                          '7-Day Free Office Pilot': 0,
                        };
                        setCompForm({
                          ...compForm,
                          plan_tier: tier,
                          monthly_retainer: priceMap[tier] ?? 300000,
                        });
                      }}
                    >
                      <option value="Growth Department SLA">
                        Growth Department SLA (₦300,000/mo)
                      </option>
                      <option value="Starter Office SLA">Starter Office SLA (₦150,000/mo)</option>
                      <option value="Enterprise Managed SLA">
                        Enterprise Managed SLA (₦550,000/mo)
                      </option>
                      <option value="7-Day Free Office Pilot">7-Day Free Office Pilot (₦0)</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Assign Dedicated IT Manager *</label>
                    <select
                      value={compForm.assigned_manager_id}
                      onChange={(e) =>
                        setCompForm({ ...compForm, assigned_manager_id: Number(e.target.value) })
                      }
                    >
                      {itManagers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
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
                      value={compForm.ceo_contact}
                      onChange={(e) => setCompForm({ ...compForm, ceo_contact: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>HR / Admin Contact</label>
                    <input
                      type="text"
                      value={compForm.hr_contact}
                      onChange={(e) => setCompForm({ ...compForm, hr_contact: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Corporate Website Domain</label>
                  <input
                    type="text"
                    value={compForm.domain_name}
                    onChange={(e) => setCompForm({ ...compForm, domain_name: e.target.value })}
                    placeholder="sterlingmarine.ng"
                  />
                </div>
                <button type="submit" className="btn btn-green" style={{ width: '100%' }}>
                  Create Company &amp; Activate Code &rarr;
                </button>
              </form>
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
                TICKET #{editingTicket.id} // {editingTicket.company_code}
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
                    <strong>Employee:</strong> {editingTicket.name} ({editingTicket.department}) —{' '}
                    {editingTicket.phone}
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
                          assigned_manager_id: Number(e.target.value),
                        })
                      }
                    >
                      {itManagers.map((m) => (
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
