import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudSun,
  Download,
  Gauge,
  Globe2,
  Info,
  LayoutDashboard,
  Leaf,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const formatEnergy = (value) => `${number.format(value ?? 0)} kWh`;
const formatCompact = (value) => `${number.format(value ?? 0)}`;
const PAGE_INFO = {
  overview: {
    title: "Overview",
    description: "A quick summary of India’s national electricity demand.",
  },
  usage: {
    title: "Energy usage",
    description: "Explore real, official measurements from the India-wide grid.",
  },
  forecast: {
    title: "Forecasts",
    description: "Explore the project model’s forecast using demo data.",
  },
  insights: {
    title: "Insights",
    description: "Understand patterns in the project’s demo dataset.",
  },
};

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [activePage, setActivePage] = useState(() => {
    const initialPage = window.location.hash.slice(1);
    return PAGE_INFO[initialPage] ? initialPage : "overview";
  });
  const [period, setPeriod] = useState("24h");
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboard?period=${period}`);
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || `Dashboard request failed (${response.status}).`);
      }
      const result = await response.json();
      setDashboard(result);
      setUpdatedAt(new Date());
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not connect to the energy data service.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 30_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const syncPageFromHash = () => {
      const requestedPage = window.location.hash.slice(1);
      setActivePage(PAGE_INFO[requestedPage] ? requestedPage : "overview");
    };
    window.addEventListener("popstate", syncPageFromHash);
    window.addEventListener("hashchange", syncPageFromHash);
    return () => {
      window.removeEventListener("popstate", syncPageFromHash);
      window.removeEventListener("hashchange", syncPageFromHash);
    };
  }, []);

  const navigateToPage = (page) => {
    if (!PAGE_INFO[page]) return;
    if (window.location.hash !== `#${page}`) {
      window.history.pushState(null, "", `#${page}`);
    }
    setActivePage(page);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const handleExport = () => {
    if (!dashboard) return;
    const rows = [
      ["Time", "Actual energy (kWh)", "Forecast (kWh)"],
      ...dashboard.chart.map((point) => [
        point.timestamp,
        point.actual ?? "",
        point.forecast ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "energy-forecast.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" aria-label="Wattwise home">
          <span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
          <span className="brand-name">wattwise<span>.</span></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">I</span>
          <span className="workspace-copy"><strong>India grid + demo</strong><small>Data workspace</small></span>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation" aria-label="Main navigation">
          <a className={`nav-link ${activePage === "overview" ? "active" : ""}`} href="#overview" onClick={(event) => { event.preventDefault(); navigateToPage("overview"); }}>
            <LayoutDashboard size={18} /> Overview
          </a>
          <a className={`nav-link ${activePage === "usage" ? "active" : ""}`} href="#usage" onClick={(event) => { event.preventDefault(); navigateToPage("usage"); }}>
            <Activity size={18} /> Energy usage
          </a>
          <a className={`nav-link ${activePage === "forecast" ? "active" : ""}`} href="#forecast" onClick={(event) => { event.preventDefault(); navigateToPage("forecast"); }}>
            <TrendingUp size={18} /> Forecasts <span className="nav-pill">AI</span>
          </a>
          <a className={`nav-link ${activePage === "insights" ? "active" : ""}`} href="#insights" onClick={(event) => { event.preventDefault(); navigateToPage("insights"); }}>
            <Lightbulb size={18} /> Insights
          </a>
        </nav>

        <div className="nav-label nav-label-spaced">PREFERENCES</div>
        <nav className="navigation" aria-label="Preferences">
          <a className="nav-link" href="#settings"><Settings2 size={18} /> Settings</a>
          <a className="nav-link" href="#help"><CircleHelp size={18} /> Help center</a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sustainability-card">
          <span className="sustainability-icon"><Leaf size={18} /></span>
          <strong>Small shifts, big impact</strong>
          <p>Smarter energy planning starts with knowing what’s ahead.</p>
          <a href="#insights" onClick={(event) => { event.preventDefault(); navigateToPage("insights"); }}>Explore insights <ArrowUpRight size={13} /></a>
          <div className="sustainability-glow" />
        </div>
        <button className="profile-button" type="button">
          <span className="profile-avatar">MB</span>
          <span className="profile-copy"><strong>Mahesh Bhakre</strong><small>Administrator</small></span>
          <MoreHorizontal size={19} />
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation">
            <Menu size={19} />
          </button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-divider">/</span><strong>{PAGE_INFO[activePage].title}</strong></div>
          <div className="topbar-actions">
            <button className="search-button"><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <span className="topbar-divider" />
            <button className="today-button"><CalendarDays size={15} /> Today <ChevronDown size={14} /></button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> ENERGY INTELLIGENCE</div>
              <h1>{activePage === "overview" ? <>{greeting}, Mahesh <span className="wave">✦</span></> : PAGE_INFO[activePage].title}</h1>
              <p className="welcome-subtitle">{activePage === "overview" ? "Official India-wide grid demand, with the project’s demo forecast shown separately." : PAGE_INFO[activePage].description}</p>
            </div>
            <div className="welcome-actions">
              {activePage === "overview" || activePage === "usage"
                ? <div className="live-status"><span className="pulse-dot" /> OFFICIAL GRID DATA</div>
                : <div className="live-status"><span className="demo-dot" /> DEMO DATA · MODEL ESTIMATE</div>}
              {activePage === "forecast" && <button className="export-button" onClick={handleExport} disabled={!dashboard}><Download size={16} /> Export report</button>}
            </div>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} />
              <div><strong>Energy data is unavailable.</strong><span>{error} Start the local Python API and refresh.</span></div>
              <button onClick={loadDashboard}>Try again</button>
            </div>
          )}

          {activePage === "usage" && <section className="official-grid-card" aria-label="Official India electricity demand">
            <div className="official-grid-heading">
              <div>
                <div className="section-kicker"><span className="kicker-icon kicker-grid"><Globe2 size={14} /></span> INDIA · NATIONAL GRID</div>
                <h2>Real electricity demand</h2>
                <p>How much power the whole India grid was supplying to meet demand—not one company or building.</p>
              </div>
              <div className="official-grid-actions">
                {dashboard?.india_grid?.status === "available" && (
                  <span className="grid-updated"><span className="grid-status-dot" /> Latest reading · {new Date(dashboard.india_grid.latest_timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} IST</span>
                )}
                <a className="source-link" href={dashboard?.india_grid?.source_url ?? "https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart"} target="_blank" rel="noreferrer">
                  <span>National Power Portal · MERIT India</span><ArrowUpRight size={13} />
                </a>
              </div>
            </div>
            {dashboard?.india_grid?.status === "available" ? (
              <>
                <div className="grid-metrics">
                  <GridMetric icon={<Activity size={16} />} tone="teal" label="LATEST DEMAND" value={dashboard.india_grid.latest_demand_mw} unit="MW" detail="Most recent official reading" />
                  <GridMetric icon={<TrendingUp size={16} />} tone="orange" label="TODAY'S PEAK" value={dashboard.india_grid.peak_demand_mw} unit="MW" detail="Highest reading in this report" />
                  <GridMetric icon={<Gauge size={16} />} tone="violet" label="TODAY'S AVERAGE" value={dashboard.india_grid.average_demand_mw} unit="MW" detail="Average of reported readings" />
                  <GridMetric icon={<Clock3 size={16} />} tone="blue" label="READINGS IN REPORT" value={dashboard.india_grid.reading_count} unit="" detail={new Date(`${dashboard.india_grid.report_date}T12:00:00`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })} />
                </div>
                <div className="grid-chart-heading">
                  <div><strong>National demand through the day</strong><span>Real measurements from the official data feed</span></div>
                  <span className="mw-legend"><i /> Demand met (MW)</span>
                </div>
                <div className="grid-demand-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.india_grid.chart} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gridDemandGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ffb267" stopOpacity={0.24} />
                          <stop offset="95%" stopColor="#ffb267" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#292f3b" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8791a0", fontSize: 10 }} interval={Math.max(1, Math.floor(dashboard.india_grid.chart.length / 10))} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8791a0", fontSize: 10 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={40} />
                      <Tooltip content={<GridDemandTooltip />} />
                      <Area type="monotone" dataKey="demand_mw" name="India grid demand" stroke="#ffb267" strokeWidth={2} fill="url(#gridDemandGradient)" activeDot={{ r: 4, fill: "#ffb267", stroke: "#151b26", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid-source-note"><Info size={13} /> MW measures power at a moment. This is national grid demand, not a home/company energy bill in kWh. Data is published by CEA on the National Power Portal via MERIT India.</div>
              </>
            ) : (
              <div className="grid-unavailable" role="status">
                <CircleHelp size={17} />
                <span>{dashboard?.india_grid?.error ?? "Connecting to the official India grid data source…"}</span>
                <button onClick={loadDashboard}>Refresh</button>
              </div>
            )}
          </section>}

          {activePage === "overview" && (
            <section className="overview-snapshot chart-card">
              <div className="card-heading">
                <div>
                  <div className="section-kicker"><span className="kicker-icon kicker-grid"><Globe2 size={14} /></span> TODAY’S NATIONAL GRID SNAPSHOT</div>
                  <h2>India-wide electricity demand</h2>
                  <p>Public grid data for the whole country—not a specific company or building.</p>
                </div>
                {dashboard?.india_grid?.status === "available" && <span className="grid-updated"><span className="grid-status-dot" /> Updated {new Date(dashboard.india_grid.latest_timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} IST</span>}
              </div>
              {dashboard?.india_grid?.status === "available" ? (
                <>
                  <div className="grid-metrics overview-metrics">
                    <GridMetric icon={<Activity size={16} />} tone="teal" label="LATEST DEMAND" value={dashboard.india_grid.latest_demand_mw} unit="MW" detail="Most recent official reading" />
                    <GridMetric icon={<TrendingUp size={16} />} tone="orange" label="TODAY'S PEAK" value={dashboard.india_grid.peak_demand_mw} unit="MW" detail="Highest reported today" />
                    <GridMetric icon={<Gauge size={16} />} tone="violet" label="TODAY'S AVERAGE" value={dashboard.india_grid.average_demand_mw} unit="MW" detail="Average reported today" />
                    <GridMetric icon={<Clock3 size={16} />} tone="blue" label="READINGS TODAY" value={dashboard.india_grid.reading_count} unit="" detail="From the official feed" />
                  </div>
                  <div className="overview-actions">
                    <span><Info size={13} /> MW is national grid power demand; it is not building energy consumption.</span>
                    <button className="export-button" onClick={() => navigateToPage("usage")}>Explore energy usage <ArrowUpRight size={14} /></button>
                  </div>
                </>
              ) : (
                <div className="grid-unavailable" role="status"><CircleHelp size={17} /><span>{dashboard?.india_grid?.error ?? "Connecting to the official India grid data source…"}</span><button onClick={loadDashboard}>Refresh</button></div>
              )}
              <div className="overview-shortcuts">
                <button onClick={() => navigateToPage("forecast")}><TrendingUp size={15} /><span><strong>Forecasts</strong><small>Open the project model demo</small></span><ArrowUpRight size={14} /></button>
                <button onClick={() => navigateToPage("insights")}><Lightbulb size={15} /><span><strong>Insights</strong><small>Explore demo data patterns</small></span><ArrowUpRight size={14} /></button>
              </div>
            </section>
          )}

          {(activePage === "forecast" || activePage === "insights") && <section className="data-context" aria-label="About this dashboard data">
            <span className="data-context-icon"><Info size={17} /></span>
            <div className="data-context-copy">
              <strong>{activePage === "forecast" ? "About this forecast" : "About these insights"}</strong>
              <p>This page uses the project’s separate demo data from its CSV. That file does <b>not</b> identify a company, building, or meter, and its original source is not documented. The real India grid measurements are on the Energy usage page; this demo is not a forecast or analysis of India’s grid.</p>
              <span className="data-context-source">SOURCE: data/energy.csv <i /> {dashboard?.history_coverage ?? "Loading date range..."}</span>
            </div>
            <span className="data-context-badge">DEMO DATA</span>
          </section>}

          {activePage === "forecast" && <section className="metric-grid" aria-label="Energy summary">
            <MetricCard
              icon={<Zap size={17} />}
              iconClass="icon-cyan"
              label="ENERGY USED"
              value={dashboard ? formatCompact(dashboard.metrics.period_energy) : "—"}
              unit="kWh"
              change={dashboard?.metrics.energy_change}
              note={`Latest recorded ${period === "24h" ? "24h" : "7d"} window`}
            />
            <MetricCard
              icon={<Gauge size={17} />}
              iconClass="icon-violet"
              label="FORECAST ACCURACY"
              value={dashboard ? `${number.format(dashboard.metrics.accuracy)}%` : "—"}
              change={dashboard?.metrics.accuracy_change}
              note="Checked against held-back readings"
              inverse
            />
            <MetricCard
              icon={<Activity size={17} />}
              iconClass="icon-orange"
              label="PEAK DEMAND"
              value={dashboard ? formatCompact(dashboard.metrics.peak_demand) : "—"}
              unit="kWh"
              change={dashboard?.metrics.peak_change}
              note={dashboard ? `Peak at ${dashboard.metrics.peak_time}` : "Highest recent hourly use"}
            />
            <MetricCard
              icon={<Sparkles size={17} />}
              iconClass="icon-green"
              label="NEXT 24H OUTLOOK"
              value={dashboard ? formatCompact(dashboard.metrics.next_day_forecast) : "—"}
              unit="kWh"
              note="AI-estimated energy use"
              accent
            />
          </section>}

          {activePage === "forecast" && <section className="chart-card primary-chart-card">
            <div className="card-heading chart-heading">
              <div>
                <div className="section-kicker"><span className="kicker-icon"><Activity size={14} /></span> DEMO CSV · MODEL OUTPUT</div>
                <h2>Sample usage & forecast</h2>
                <p>Historical sample readings compared with the project model’s estimate.</p>
              </div>
              <div className="chart-controls">
                <div className="segmented-control" role="group" aria-label="Chart time period">
                  <button className={period === "24h" ? "selected" : ""} onClick={() => setPeriod("24h")}>24 hours</button>
                  <button className={period === "7d" ? "selected" : ""} onClick={() => setPeriod("7d")}>7 days</button>
                </div>
                <button className="more-button" aria-label="More chart options"><MoreHorizontal size={19} /></button>
              </div>
            </div>

            <div className="chart-summary">
              <div className="chart-total">{dashboard ? formatEnergy(dashboard.metrics.period_energy) : "—"} <span>sample energy in selected period</span></div>
              <div className="chart-legend">
                <span><i className="legend-dot legend-actual" /> Actual usage</span>
                <span><i className="legend-dot legend-forecast" /> AI forecast</span>
              </div>
            </div>
            <div className="main-chart">
              {loading && !dashboard ? <ChartLoading /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard?.chart ?? []} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#33d6c4" stopOpacity={0.21} />
                        <stop offset="92%" stopColor="#33d6c4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9876ff" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#9876ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#252d3b" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#788396", fontSize: 11 }} interval={period === "24h" ? 5 : 23} dy={9} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#788396", fontSize: 11 }} tickFormatter={formatCompact} width={43} />
                    <Tooltip content={<EnergyTooltip />} />
                    <Area type="monotone" dataKey="actual" name="Actual usage" stroke="#39d6c3" strokeWidth={2.3} fill="url(#actualGradient)" connectNulls={false} activeDot={{ r: 4, fill: "#39d6c3", stroke: "#101a25", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="forecast" name="AI forecast" stroke="#9b7bff" strokeWidth={2.3} strokeDasharray="6 5" fill="url(#forecastGradient)" connectNulls activeDot={{ r: 4, fill: "#9b7bff", stroke: "#101a25", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="chart-footnote"><span className="footnote-info">i</span> Teal = recorded CSV readings; purple = model estimate, not an actual meter reading.<span className="updated-time"><Clock3 size={12} /> Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
          </section>}

          {activePage === "insights" && <section className="secondary-grid">
            <article className="chart-card hourly-card">
              <div className="card-heading compact-heading">
                <div>
                  <div className="section-kicker"><span className="kicker-icon kicker-coral"><Clock3 size={13} /></span> DAILY RHYTHM</div>
                  <h2>Usage by hour</h2>
                  <p>Your average energy pattern through the day.</p>
                </div>
                <button className="more-button" aria-label="More hourly chart options"><MoreHorizontal size={19} /></button>
              </div>
              <div className="hourly-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard?.hourly_profile ?? []} margin={{ top: 15, right: 2, left: -19, bottom: 0 }}>
                    <CartesianGrid stroke="#252d3b" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#788396", fontSize: 10 }} interval={3} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#788396", fontSize: 10 }} width={40} />
                    <Tooltip content={<EnergyTooltip />} cursor={{ fill: "rgba(255,255,255,.035)" }} />
                    <Bar dataKey="average" name="Average use" radius={[4, 4, 0, 0]} maxBarSize={14}>
                      {(dashboard?.hourly_profile ?? []).map((entry) => <Cell key={entry.hour} fill={entry.is_peak ? "#ff9e68" : "#5360cb"} fillOpacity={entry.is_peak ? 1 : 0.72} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="hourly-note"><span className="peak-marker" /> Your busiest hour is around <strong>{dashboard?.metrics.typical_peak_time ?? "—"}</strong></div>
            </article>

            <article className="chart-card distribution-card">
              <div className="card-heading compact-heading">
                <div>
                  <div className="section-kicker"><span className="kicker-icon kicker-blue"><CloudSun size={14} /></span> DAILY BREAKDOWN</div>
                  <h2>When energy is used</h2>
                  <p>Share of recorded use across each part of the day.</p>
                </div>
                <button className="more-button" aria-label="More breakdown options"><MoreHorizontal size={19} /></button>
              </div>
              <div className="distribution-content">
                <div className="donut-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dashboard?.daypart_share ?? []} dataKey="share" nameKey="name" innerRadius={57} outerRadius={77} paddingAngle={4} stroke="none" startAngle={90} endAngle={-270}>
                        {(dashboard?.daypart_share ?? []).map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ShareTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center"><strong>{dashboard ? `${number.format(dashboard.metrics.average_hourly)} ` : "—"}<small>kWh</small></strong><span>hourly avg.</span></div>
                </div>
                <div className="daypart-legend">
                  {(dashboard?.daypart_share ?? []).map((part) => (
                    <div className="daypart-row" key={part.name}>
                      <span className="daypart-label"><i style={{ background: part.color }} />{part.name}</span>
                      <strong>{number.format(part.share)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="distribution-note"><Sparkles size={14} /> This pattern comes from the project sample CSV, not company or grid data.</div>
            </article>
          </section>}

          {activePage === "forecast" && <section className="single-page-panel">
            <article className="chart-card forecast-table-card">
              <div className="card-heading compact-heading table-heading">
                <div>
                  <div className="section-kicker"><span className="kicker-icon kicker-violet"><TrendingUp size={14} /></span> COMING UP</div>
                  <h2>Next 6 hours</h2>
                  <p>A simple look at what the model expects.</p>
                </div>
                <span className="forecast-tag"><Sparkles size={12} /> Model forecast</span>
              </div>
              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead><tr><th>TIME</th><th>EXPECTED USE</th><th>OUTLOOK</th></tr></thead>
                  <tbody>
                    {(dashboard?.next_hours ?? []).map((item) => (
                      <tr key={item.timestamp}>
                        <td><span className="table-time">{item.time}</span></td>
                        <td><strong>{formatEnergy(item.forecast)}</strong></td>
                        <td><span className={`outlook-chip ${item.status === "High" ? "outlook-high" : "outlook-normal"}`}><i /> {item.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>}

          {activePage === "insights" && <section className="insights-page-grid">
            <article className="chart-card insights-card">
              <div className="card-heading compact-heading">
                <div>
                  <div className="section-kicker"><span className="kicker-icon kicker-gold"><Lightbulb size={14} /></span> QUICK INSIGHTS</div>
                  <h2>Worth a look</h2>
                  <p>Helpful highlights from your energy pattern.</p>
                </div>
              </div>
              <div className="insights-list">
                {(dashboard?.insights ?? []).map((insight, index) => (
                  <div className="insight-row" key={`${insight.title}-${index}`}>
                    <span className={`insight-icon insight-${insight.tone}`}>{insight.tone === "green" ? <Leaf size={15} /> : insight.tone === "orange" ? <Zap size={15} /> : <TrendingUp size={15} />}</span>
                    <div><strong>{insight.title}</strong><p>{insight.description}</p></div>
                    <ArrowUpRight size={15} className="insight-arrow" />
                  </div>
                ))}
              </div>
              <div className="all-insights"><span><Check size={13} /></span> Based on your energy history</div>
            </article>
          </section>
          }
          <footer className="footer"><span>Wattwise Energy Intelligence</span><span>Clear insights. Smarter decisions.</span></footer>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ icon, iconClass, label, value, unit, change, note, inverse = false, accent = false }) {
  const isPositive = change != null && (inverse ? change >= 0 : change <= 0);
  return (
    <article className={`metric-card ${accent ? "metric-accent" : ""}`}>
      <div className="metric-top"><span className={`metric-icon ${iconClass}`}>{icon}</span><button aria-label={`More about ${label}`}><MoreHorizontal size={18} /></button></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}<span>{unit}</span></div>
      <div className="metric-bottom">
        {change == null ? <span className="metric-note">{note}</span> : (
          <>
            <span className={`change-pill ${isPositive ? "change-positive" : "change-negative"}`}>
              {isPositive ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="metric-note">{note}</span>
          </>
        )}
      </div>
      {accent && <span className="metric-shimmer" />}
    </article>
  );
}

function GridMetric({ icon, tone, label, value, unit, detail }) {
  return (
    <div className="grid-metric">
      <div className="grid-metric-top"><span className={`grid-metric-icon grid-tone-${tone}`}>{icon}</span><span>{label}</span></div>
      <div className="grid-metric-value">{number.format(value)}<span>{unit}</span></div>
      <div className="grid-metric-detail">{detail}</div>
    </div>
  );
}

function EnergyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>{label}</span>
      {payload.map((item) => item.value != null && <strong key={item.dataKey} style={{ color: item.color }}>{item.name}: {formatEnergy(item.value)}</strong>)}
    </div>
  );
}

function GridDemandTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>{label} IST</span>
      <strong style={{ color: "#ffb267" }}>Demand met: {number.format(payload[0].value)} MW</strong>
    </div>
  );
}

function ShareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const part = payload[0].payload;
  return <div className="chart-tooltip"><strong style={{ color: part.color }}>{part.name}: {number.format(part.share)}%</strong><span>of recorded energy</span></div>;
}

function ChartLoading() {
  return <div className="chart-loading"><span className="loading-spinner" /> Loading your energy data...</div>;
}

export default App;
