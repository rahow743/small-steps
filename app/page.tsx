import Script from 'next/script';
export default function Home() {
  return <>
    <div id="app" aria-live="polite"><div className="initial-loading"><span className="loading-mark">s.</span><p>Making room for your small wins…</p></div></div>
    <div id="toast" role="status" aria-live="polite" />
    <dialog id="modal" />
    <noscript>Small Steps needs JavaScript enabled to sign in and save your progress.</noscript>
    <Script src="/app.js" type="module" strategy="afterInteractive" />
  </>;
}
