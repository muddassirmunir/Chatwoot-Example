"use client"; // Make this a client component so it can load third-party widget scripts.

import Script from "next/script"; // Next helper for non-blocking script injection.
import styles from "./page.module.css"; // Existing styles from the generated template.

export default function Home() {
  const CHATWOOT_BASE_URL =
    process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL ??
    "https://YOUR_CHATWOOT_BASE_URL"; // The Chatwoot instance URL (e.g. https://app.chatwoot.com).

  const CHATWOOT_WEBSITE_TOKEN =
    process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN ??
    "YOUR_WEBSITE_TOKEN"; // The Website inbox token from Chatwoot settings.

  const chatwootInitSnippet = `window.chatwootSettings=${JSON.stringify({
    position: "left",
    type: "standard",
    launcherTitle: "",
  })};
  (function(d,t){
    var BASE_URL=${JSON.stringify(CHATWOOT_BASE_URL)};
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+'/packs/js/sdk.js';
    g.defer=true;
    g.async=true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({
        websiteToken: ${JSON.stringify(CHATWOOT_WEBSITE_TOKEN)},
        baseUrl: BASE_URL
      });
    };
  })(document,'script');`; // Hosted widget loader snippet.

  return (
    <div className={styles.page}>
      <Script
        id="chatwoot-widget-snippet"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: chatwootInitSnippet }}
      />{" "}
      {/* Load the widget after hydration so it doesn't block initial page rendering. */}

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Chatwoot Hosted Widget POC</h1>
          <p>
            This is a minimal Next.js page for validating Chatwoot hosted chat
            widget behavior (messaging, persistence, attachments, responsiveness).
          </p>
          <p>
            Set `NEXT_PUBLIC_CHATWOOT_BASE_URL` and `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN`
            in your environment to connect the widget.
          </p>
        </div>

        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://developers.chatwoot.com/api-reference/introduction"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chatwoot Docs
          </a>
          <a
            className={styles.secondary}
            href="https://www.postman.com/chatwoot/chatwoot-apis/collection/m2zyu6l/chatwoot-platform-apis"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chatwoot APIs (Postman)
          </a>
        </div>

        <section aria-label="POC checklist">
          <h2>What to validate</h2>
          <ul>
            <li>Send and receive messages</li>
            <li>Conversation persistence</li>
            <li>File attachment upload</li>
            <li>Responsive behavior across screen sizes</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
