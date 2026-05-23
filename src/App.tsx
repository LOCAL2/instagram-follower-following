import { useState, useEffect } from 'react'
import manifest from '../extension/manifest.json'
import './App.css'

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)
const IconArrowPath = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)
const IconChartBar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const IconShieldCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)
const IconArrowDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
  </svg>
)
const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)
const IconCheckSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={13} height={13} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)
const IconCopy = ({ done }: { done: boolean }) => done ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={13} height={13} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
) : (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={13} height={13} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
)

// ── Brand logos ───────────────────────────────────────────────────────────────
const IGLogo = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="ig-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f09433" />
        <stop offset="25%" stopColor="#e6683c" />
        <stop offset="50%" stopColor="#dc2743" />
        <stop offset="75%" stopColor="#cc2366" />
        <stop offset="100%" stopColor="#bc1888" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="13" fill="url(#ig-g)" />
    <rect x="9" y="9" width="30" height="30" rx="7" stroke="white" strokeWidth="2.5" fill="none" />
    <circle cx="24" cy="24" r="7.5" stroke="white" strokeWidth="2.5" fill="none" />
    <circle cx="33" cy="15" r="2" fill="white" />
  </svg>
)

const ChromeLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#fff" />
    <path d="M12 8h8.66a10 10 0 11-17.32 0z" fill="#EA4335" />
    <path d="M12 8h8.66A10 10 0 0112 2v6z" fill="#FBBC05" />
    <path d="M12 8H3.34A10 10 0 0012 22V8z" fill="#34A853" />
    <circle cx="12" cy="12" r="4" fill="#4285F4" />
    <circle cx="12" cy="12" r="2.4" fill="white" />
  </svg>
)

// ── Static data ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <IconUsers />,       title: 'ไม่ follow กลับ',       desc: 'ดูรายชื่อทุกคนที่คุณ follow แต่เขาไม่ได้ follow คุณกลับ พร้อมลิงก์โปรไฟล์', color: 'blue'   },
  { icon: <IconArrowPath />,   title: 'ฉันไม่ได้ follow กลับ', desc: 'ดูรายชื่อคนที่ follow คุณ แต่คุณยังไม่ได้ follow กลับ ครบทุกคน',            color: 'purple' },
  { icon: <IconChartBar />,    title: 'สถิติครบถ้วน',           desc: 'แสดงจำนวน followers, following และสรุปผลทันทีในหน้าเดียว',                   color: 'cyan'   },
  { icon: <IconShieldCheck />, title: 'ปลอดภัย 100%',           desc: 'ข้อมูลทั้งหมดประมวลผลในเบราว์เซอร์ของคุณ ไม่มีการส่งออกภายนอก',             color: 'green'  },
] as const

const HOW_STEPS = [
  { n: '1', title: 'ติดตั้ง Extension',    desc: 'ดาวน์โหลดและ load extension เข้า Chrome ผ่าน Developer Mode ใช้เวลาไม่ถึง 1 นาที' },
  { n: '2', title: 'เปิด Instagram',        desc: 'ไปที่ instagram.com และ login บัญชีของคุณตามปกติ ไม่ต้องทำอะไรพิเศษ' },
  { n: '3', title: 'คลิกไอคอน & ตรวจสอบ', desc: 'กดไอคอน extension ที่ toolbar กรอก username แล้วดูผลลัพธ์ได้ทันที' },
]

type StepType = 'download' | 'copy' | 'text' | 'done'
const INSTALL_STEPS: { num: string; title: string; desc: string; type: StepType; copyText?: string }[] = [
  { num: '01', title: 'ดาวน์โหลด Extension',  desc: 'กดปุ่มด้านล่างเพื่อดาวน์โหลดไฟล์ extension.zip',                                      type: 'download' },
  { num: '02', title: 'ไปที่หน้า Extensions', desc: 'คัดลอก chrome://extensions ไปวางในช่อง address bar แล้วเปิด Developer Mode ขวาบน',     type: 'copy', copyText: 'chrome://extensions' },
  { num: '03', title: 'ลากไฟล์ลงมาวาง',       desc: 'ลากไฟล์ extension.zip ที่ดาวน์โหลดมา วางลงในหน้า Extensions ได้ทันที',                 type: 'text' },
]

const CARD_ITEMS = [
  'ใช้งานฟรี 100%',
  'เน้นความเป็นส่วนตัว (Zero Data Collection)',
  'เชื่อมต่อผ่านเซสชัน Instagram โดยตรง',
]

// ── Mockup Component ──────────────────────────────────────────────────────────
import { memo } from 'react'
const MockupPreview = memo(() => {
  const stats = [
    { v: '1,284', l: 'Followers',          c: ''       },
    { v: '892',   l: 'Following',           c: ''       },
    { v: '47',    l: 'ไม่ follow กลับ',     c: 'red'    },
    { v: '239',   l: 'ฉันไม่ follow กลับ',  c: 'purple' },
  ]
  return (
    <div className="hero-mockup" aria-hidden="true">
      <div className="mockup-browser">
        <div className="mockup-bar">
          <div className="mockup-dots"><span /><span /><span /></div>
          <div className="mockup-url">instagram.com</div>
        </div>
        <div className="mockup-panel">
          <div className="mockup-panel-head">
            <div className="mockup-panel-brand"><IGLogo size={20} /><span>Follower Tracker</span></div>
            <div className="mockup-panel-actions">
              <div className="mockup-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg></div>
              <div className="mockup-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></div>
              <div className="mockup-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 6l12 12M6 18L18 6"/></svg></div>
            </div>
          </div>
          <div className="mockup-search">
            <div className="mockup-input"><span>@&nbsp;</span><div className="mockup-placeholder">your_username...</div></div>
            <div className="mockup-btn">ตรวจสอบ</div>
          </div>
          <div className="mockup-stats">
            {stats.map(s => (
              <div className={`mockup-stat${s.c ? ` mockup-stat--${s.c}` : ''}`} key={s.l}>
                <span className="mockup-stat-n">{s.v}</span>
                <span className="mockup-stat-l">{s.l}</span>
              </div>
            ))}
          </div>
          <div className="mockup-tabs">
            <span className="mockup-tab mockup-tab--on">ไม่ follow กลับ</span>
            <span className="mockup-tab">ฉันไม่ follow กลับ</span>
          </div>
          <div className="mockup-user-list">
            {[
              { id: 'design_inspire', name: 'Design Daily', g: 'gradient-1' },
              { id: 'tech_minimal',   name: 'Tech Review',  g: 'gradient-2' },
              { id: 'travel_vibe',    name: 'Nomad Soul',   g: 'gradient-3' },
            ].map(u => (
              <div className="mockup-user" key={u.id}>
                <div className={`mockup-avatar ${u.g}`} />
                <div className="mockup-info">
                  <div className="mockup-uname">@{u.id}</div>
                  <div className="mockup-fname">{u.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

// ── App component ─────────────────────────────────────────────────────────────
export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [siteVersion, setSiteVersion] = useState<string>(manifest.version)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    fetch('/version.json')
      .then(r => r.json())
      .then(data => {
        if (data.version) setSiteVersion(data.version)
        if (data.date) {
          const d = new Date(data.date)
          setLastUpdate(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        }
      })
      .catch(() => {})
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setShowToast(true)
    setTimeout(() => { setCopied(false); setShowToast(false) }, 3000)
  }

  return (
    <div className="page">

      {/* Toast */}
      <div className={`igt-toast-wrap ${showToast ? 'igt-toast--show' : ''}`}>
        <div className="igt-toast">
          <div className="igt-toast-icon"><IconCheckSm /></div>
          <div className="igt-toast-content">
            <div className="igt-toast-title">คัดลอกสำเร็จ!</div>
            <div className="igt-toast-desc">นำไปวางในช่อง URL ด้านบนได้เลย</div>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} aria-label="Main navigation">
        <div className="navbar-inner">
          <div className="navbar-brand"><IGLogo size={30} /><span className="navbar-name">IG Follower Tracker</span></div>
          <a className="navbar-cta" href="#install">ติดตั้งฟรี</a>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-glow hero-glow--1" aria-hidden="true" />
        <div className="hero-glow hero-glow--2" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-ver-wrap">
            <span className="hero-badge"><ChromeLogo size={13} />Chrome Extension — ฟรี</span>
            {lastUpdate && <span className="hero-update-tag">อัปเดตเมื่อ: {lastUpdate}</span>}
          </div>
          <h1 className="hero-title">รู้ทันว่าใคร<br /><span className="hero-gradient">ไม่ follow กลับ</span></h1>
          <p className="hero-desc">ตรวจสอบ followers และ following บน Instagram ได้ทันที ไม่ต้องกรอก password ไม่ต้องใช้ third-party app ข้อมูลอยู่ในเบราว์เซอร์ของคุณเท่านั้น</p>
          <div className="hero-actions">
            <a className="btn-primary" href="#install"><ChromeLogo size={17} />ติดตั้ง Extension ฟรี</a>
            <a className="btn-ghost" href="#how-it-works">ดูวิธีใช้งาน<span className="btn-ghost-arrow"><IconArrowDown /></span></a>
          </div>
        </div>
        <MockupPreview />
      </header>

      {/* Features */}
      <section className="section sec-features" aria-labelledby="feat-h">
        <div className="sec-inner">
          <p className="sec-label">ฟีเจอร์</p>
          <h2 className="sec-title" id="feat-h">ทุกอย่างที่คุณต้องการ</h2>
          <p className="sec-desc">ใช้งานง่าย ผลลัพธ์ชัดเจน ไม่มีขั้นตอนซับซ้อน</p>
          <div className="feat-grid">
            {FEATURES.map(f => (
              <div className={`feat-card feat-card--${f.color}`} key={f.title}>
                <div className="feat-icon">{f.icon}</div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section sec-how" id="how-it-works" aria-labelledby="how-h">
        <div className="sec-inner">
          <p className="sec-label">วิธีใช้งาน</p>
          <h2 className="sec-title" id="how-h">ใช้งานได้ใน 3 ขั้นตอน</h2>
          <div className="how-row">
            {HOW_STEPS.map((s, i) => (
              <>
                <div className="how-step" key={s.n}>
                  <div className="how-num">{s.n}</div>
                  <h3 className="how-title">{s.title}</h3>
                  <p className="how-desc">{s.desc}</p>
                </div>
                {i < HOW_STEPS.length - 1 && <div className="how-line" key={`ln-${i}`} aria-hidden="true" />}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="section sec-install" id="install" aria-labelledby="inst-h">
        <div className="sec-inner">
          <p className="sec-label">ติดตั้ง</p>
          <h2 className="sec-title" id="inst-h">ติดตั้งใน 3 ขั้นตอน</h2>
          <p className="sec-desc">ยังไม่ได้อยู่บน Chrome Web Store — ติดตั้งแบบ Developer Mode ได้เลย</p>
          <div className="inst-grid">
            <ol className="inst-list">
              {INSTALL_STEPS.map(step => (
                <li className={`inst-step${step.type === 'done' ? ' inst-step--done' : ''}`} key={step.num}>
                  <span className="inst-num">{step.num}</span>
                  <div className="inst-body">
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                    {step.type === 'download' && (
                      <a className="btn-dl" href="/extension.zip" download><IconDownload />ดาวน์โหลด extension.zip</a>
                    )}
                    {step.type === 'copy' && step.copyText && (
                      <div className="code-row-wrap">
                        <div className="code-row">
                          <code>{step.copyText}</code>
                          <button className={`copy-btn${copied ? ' copy-btn--done' : ''}`} onClick={() => handleCopy(step.copyText!)} aria-label={copied ? 'คัดลอกแล้ว' : 'คัดลอก'}>
                            <IconCopy done={copied} />{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="inst-card">
              <IGLogo size={44} />
              <h3>Instagram Follower Tracker</h3>
              <p>Chrome Extension v{siteVersion}</p>
              {lastUpdate && <p className="inst-card-update">อัปเดตล่าสุด: {lastUpdate}</p>}
              <ul>{CARD_ITEMS.map(t => (<li key={t}><span className="check-wrap" aria-hidden="true"><IconCheckSm /></span>{t}</li>))}</ul>
              <a className="btn-card-dl" href="/extension.zip" download><IconDownload />ดาวน์โหลดเลย</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="sec-cta" aria-labelledby="cta-h">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-inner">
          <h2 id="cta-h">พร้อมตรวจสอบ follower แล้วหรือยัง?</h2>
          <p>ติดตั้งฟรี ใช้งานได้ทันที ไม่ต้องสมัครสมาชิก</p>
          <a className="btn-primary" href="#install"><ChromeLogo size={17} />ติดตั้ง Extension ฟรี</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand"><IGLogo size={26} /><span>IG Follower Tracker</span></div>
          <p className="footer-note">ข้อมูลทั้งหมดประมวลผลในเบราว์เซอร์ของคุณ ไม่มีการเก็บหรือส่งข้อมูลออกภายนอก</p>
        </div>
      </footer>

    </div>
  )
}
