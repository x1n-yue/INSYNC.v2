import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconLogOut, IconGrid, IconMenu } from "./Icons";
import Brand from "./Brand";
import Modal from "./Modal";

const MAX_BOTTOM_TABS = 5;

export default function Shell({ userName, userEmail, userRole, navItems, activeTab, onTabChange, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const main = useRef(null), previousTab = useRef(activeTab);
  const initials = (userName || "Account").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const activeItem = navItems.find(item => item.id === activeTab);
  const needsOverflow = navItems.length > MAX_BOTTOM_TABS;
  const primaryTabs = needsOverflow ? navItems.slice(0, 4) : navItems;
  const overflowHasActive = !primaryTabs.some(item => item.id === activeTab);

  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    main.current?.scrollTo({ top: 0 });
    main.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [activeTab]);

  const navigate = id => { onTabChange(id); setShowMore(false); };
  const navigation = compact => navItems.map(item => <button key={item.id} type="button"
    onClick={() => navigate(item.id)} aria-label={item.label} aria-current={activeTab === item.id ? "page" : undefined}
    title={compact ? item.label : undefined} className={`sidebar-link ${activeTab === item.id ? "is-active" : ""}`}>
    <span className="sidebar-icon">{item.icon}</span>{!compact && <span>{item.label}</span>}
  </button>);
  const account = compact => <div className="shell-account">
    <span className="account-avatar">{initials}</span>
    {!compact && <div className="min-w-0"><p className="account-name">{userName}</p><p className="account-email" title={userEmail}>{userEmail}</p><span className="account-role">{userRole}</span></div>}
  </div>;

  return <div className={`dashboard-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a href="#dashboard-main" className="skip-link">Skip to content</a>
    <aside className="desktop-sidebar">
      <div className="sidebar-brand"><Brand compact={collapsed} />{!collapsed && <p>INTERNSHIP PORTAL</p>}</div>
      {!collapsed && <p className="sidebar-section-label">Workspace</p>}
      <nav aria-label={`${userRole} navigation`} className="sidebar-navigation">{navigation(collapsed)}</nav>
      <footer className="sidebar-footer">
        {account(collapsed)}
        <button type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="sidebar-link">
          <span className="sidebar-icon">{collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}</span>{!collapsed && <span>Collapse</span>}
        </button>
        <button type="button" onClick={onLogout} aria-label="Sign Out" title={collapsed ? "Sign Out" : undefined} className="sidebar-link">
          <span className="sidebar-icon"><IconLogOut size={18} /></span>{!collapsed && <span>Sign Out</span>}
        </button>
      </footer>
    </aside>
    <div className="shell-workspace">
      <header className="workspace-bar">
        <div className="mobile-workspace-brand"><button type="button" className="menu-button" aria-label="Open navigation" aria-expanded={showMore} onClick={() => setShowMore(true)}><IconMenu size={22} /></button><Brand inverse={false} /></div>
        <div className="workspace-breadcrumb"><span>{userRole}</span><IconChevronRight size={14} /><span>{activeItem?.label}</span></div>
        <button type="button" className="workspace-profile" onClick={() => setShowProfile(true)} aria-label="Open account menu">
          <span className="workspace-profile-name">{userName}</span><span className="account-avatar">{initials}</span>
        </button>
      </header>
      <main id="dashboard-main" ref={main} tabIndex={-1} className="dashboard-content">{children}</main>
      <nav aria-label="Mobile navigation" className="mobile-tabs">
        {primaryTabs.map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)} aria-current={activeTab === item.id ? "page" : undefined} className={activeTab === item.id ? "is-active" : ""}>
          {item.icon}<span>{item.label}</span>
        </button>)}
        {needsOverflow && <button type="button" onClick={() => setShowMore(true)} className={overflowHasActive ? "is-active" : ""}><IconGrid size={18} /><span>More</span></button>}
      </nav>
    </div>
    {showMore && <Modal title="More navigation" onClose={() => setShowMore(false)} width="340px" drawer>
      <div className="drawer-brand"><Brand /></div>
      <nav aria-label={`${userRole} mobile drawer`} className="sidebar-navigation">{navigation(false)}</nav>
      {account(false)}
      <button type="button" onClick={onLogout} className="sidebar-link"><IconLogOut size={18} />Sign Out</button>
    </Modal>}
    {showProfile && <Modal title="Account menu" onClose={() => setShowProfile(false)}>
      <div className="profile-summary"><span className="account-avatar">{initials}</span><div className="min-w-0"><p className="font-semibold">{userName}</p><p className="text-sm muted-copy break-words">{userEmail}</p><p className="text-sm mt-1">{userRole}</p></div></div>
      <button type="button" onClick={onLogout} className="action-secondary mt-5 flex items-center gap-2"><IconLogOut size={16} />Sign Out</button>
    </Modal>}
  </div>;
}
