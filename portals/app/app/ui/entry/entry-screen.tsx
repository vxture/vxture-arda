"use client";

import { useState } from "react";
import { ArrowRight, ArrowsOutSimple, Globe, Moon, ShieldCheck, SpinnerGap, User } from "@phosphor-icons/react";
import { useTheme } from "@vxture/design-system";
import { useLocale } from "@arda/shared/locale-provider";
import { persistTheme } from "@arda/shared/preferences";
import type { SessionUser } from "../api";
import illustrations from "./illustrations.json";
import { productSubscriptionUrl } from "../../entitlement/deeplink";
import "./confirmed-design.css";
import "./entry.css";

export type EntryState = keyof typeof illustrations | "checking-access";

const copy = {
  signin: ["数据管理平台", "Data Management Platform"],
  connecting: ["正在连接", "Connecting"],
  restoring: ["正在恢复登录", "Restoring sign-in"],
  "checking-access": ["正在确认使用权限", "Checking access"],
  subscription: ["尚未开通", "Subscription required"],
  expired: ["订阅需要续订", "Subscription needs renewal"],
  unassigned: ["尚未分配使用角色", "No usage role assigned"],
  "access-unavailable": ["暂时无法确认使用权限", "Unable to verify access"],
  recovery: ["等待恢复登录", "Waiting for sign-in"],
  unavailable: ["暂时无法连接", "Unable to connect"],
  signedout: ["已退出登录", "Signed out"],
} satisfies Record<EntryState, string[]>;

/** Confirmed public presentation. All actions are supplied by the real entry gates. */
export function EntryScreen({ state, user, onRetry, onLogin, canManage = false, message }: {
  state: EntryState;
  user?: SessionUser;
  onRetry?: () => void | Promise<void>;
  onLogin?: () => void;
  canManage?: boolean;
  message?: string;
}) {
  const { locale, toggle } = useLocale();
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = locale === "en-US";
  const text = (zh: string, english: string) => en ? english : zh;
  const pending = ["connecting", "restoring", "checking-access"].includes(state);
  const commercial = canManage && (state === "subscription" || state === "expired");
  const security = text("使用平台账号安全登录", "Sign in securely with your platform account");
  const footnote = message || error || (state === "unassigned"
    ? text("请联系管理员为你分配使用角色。", "Contact your administrator to assign you a role.")
    : state === "subscription"
      ? text("请联系管理员开通，或由有权限的人员前往开通。", "Contact your administrator or ask an authorized person to activate access.")
      : state === "expired"
        ? text("请前往续订，或联系管理员处理。", "Renew the subscription or contact your administrator.")
        : state === "recovery"
          ? text("请保留此页，在新标签页登录后返回。", "Keep this page open; sign in in a new tab, then return.")
          : security);

  async function retry() {
    if (busy || !onRetry) return;
    setBusy(true); setError("");
    try { await onRetry(); }
    catch { setError(text("检查失败，请稍后重试。", "Check failed. Please try again.")); }
    finally { setBusy(false); }
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setError(text("当前浏览器暂不支持全屏。", "Fullscreen is unavailable in this browser.")); }
  }

  const illustration = illustrations[state === "checking-access" ? "connecting" : state];
  const login = state === "signin";
  return (
    <div className="arda-entry" data-entry-state={state}>
      <div className="cospace-home home-panorama" id="login-screen">
        <div className="home-panorama-backdrop" aria-hidden="true"><img className="arda-data-backdrop" src="/entry/arda-background.svg" alt="" /></div>
        <header className="platform-header home-header">
          <div className="arda-entry-header-inner">
            <div className="platform-product-brand" aria-label="Ruyin · Arda">
              <span className="platform-brand"><img src="/entry/ruyin-mark.svg" alt="" width="24" height="24" /><span>Ruyin</span></span>
              <span className="platform-product-divider" aria-hidden="true" />
              <a className="cospace-brand" href="/" aria-label={text("Arda 首页", "Arda home")}><img src="/entry/arda-mark.svg" alt="" width="28" height="28" /><span>Arda</span></a>
            </div>
            <div className="public-header-tools" role="group" aria-label={text("主题、语言、全屏与主站", "Theme, language, fullscreen and website")}>
              <button type="button" aria-label={text("切换主题", "Toggle theme")} onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); persistTheme(next); }}><Moon /></button>
              <button type="button" aria-label={text("语言", "Language")} onClick={toggle}><Globe /></button>
              <button type="button" aria-label={text("全屏显示", "Fullscreen")} onClick={() => void fullscreen()}><ArrowsOutSimple /></button>
              <a href="https://vxture.com/" target="_blank" rel="noopener noreferrer" aria-label={text("VXTURE 主站（新标签页）", "VXTURE website (new tab)")}><img src="/entry/website-mark.svg" width="16" height="16" alt="" /></a>
            </div>
          </div>
        </header>
        <main className="home-main home-panorama-main">
          <div className="home-content-inner"><div className="home-panorama-content">
            <p className="home-panorama-eyebrow">DATA INTELLIGENCE</p>
            <section className="home-entry home-panorama-entry" aria-label={text("Arda 访问入口", "Arda access")}>
              <div className={login ? "home-signin-content" : "entry-status"} aria-busy={pending || busy}>
                <header className="home-login-heading"><p>WELCOME TO ARDA</p><h1 aria-live="polite">{copy[state][en ? 1 : 0]}</h1></header>
                <div className={login ? "home-login-illustration" : "entry-status-body"} aria-hidden="true" dangerouslySetInnerHTML={{ __html: illustration }} />
                <div className="entry-core"><div className={login ? "home-login-actions" : "entry-operation-group"}>
                  {user ? <div className="entry-identity"><span className="entry-identity-icon"><User size={24} /></span><div className="entry-identity-copy"><strong title={user.displayName || user.username}>{user.displayName || user.username || text("当前账号", "Current account")}</strong><span title={user.orgName}>{user.orgName || text("组织信息待补全", "Organization unavailable")}</span></div></div>
                    : <div className="home-unified-account"><User size={24} /><div><strong>{text("全局统一账号", "One platform account")}</strong><p>{text("账号、单位与工作空间，一处连接", "Account, organization and workspace, connected")}</p></div></div>}
                  <div className="entry-actions">
                    {pending ? <button className="entry-action" disabled><SpinnerGap className="entry-spinner" size={18} />{text(state === "checking-access" ? "核验中…" : state === "restoring" ? "恢复中…" : "连接中…", "Please wait…")}</button> : <>
                      {commercial && <a className="entry-action" data-entry-action={state === "expired" ? "renew" : "subscribe"} href={productSubscriptionUrl(locale)} target="_blank" rel="noopener noreferrer">{state === "expired" ? text("前往续订", "Renew subscription") : text("前往开通", "Subscribe")}</a>}
                      {onLogin && <button className="entry-action" data-entry-action="login" onClick={onLogin}>{login ? text("继续登录", "Continue to sign in") : text("重新登录", "Sign in again")}{login && <ArrowRight size={16} />}</button>}
                      {onRetry && <button className={"entry-action" + (commercial || onLogin ? " entry-action-secondary" : "")} data-entry-action="retry" onClick={() => void retry()} disabled={busy}>{busy ? text("检查中…", "Checking…") : text("重新检查", "Check again")}</button>}
                      {state === "signedout" && <a className="entry-action entry-action-secondary" href="https://accounts.vxture.com/" target="_blank" rel="noopener noreferrer">{text("账号中心", "Account center")}</a>}
                    </>}
                  </div>
                </div></div>
                <footer className={login ? "home-login-security" : "entry-footnote"} role="status">{footnote === security && <ShieldCheck size={16} />}{footnote}</footer>
              </div>
            </section>
            <div className="home-panorama-message"><p>{text("让数据有序　让价值流动", "ORDER IN DATA. FLOW IN VALUE.")}</p><span>ORDER IN DATA. FLOW IN VALUE.</span></div>
          </div></div>
        </main>
        <footer className="home-footer public-legal-footer"><div className="home-footer-inner"><span>© 2026 VXTURE · RUYIN</span><nav aria-label={text("法律信息", "Legal")}>
          <a href="https://vxture.com/legal/terms" target="_blank" rel="noopener noreferrer">{text("服务条款", "Terms of service")}</a>
          <a href="https://vxture.com/legal/privacy" target="_blank" rel="noopener noreferrer">{text("隐私政策", "Privacy policy")}</a>
          <a href="https://vxture.com/legal/copyright" target="_blank" rel="noopener noreferrer">{text("版权声明", "Copyright")}</a>
        </nav></div></footer>
      </div>
    </div>
  );
}
