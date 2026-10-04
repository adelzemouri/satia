"use client";

/** Dernier filet : la mise en page elle-même a planté (pas de traductions disponibles ici). */
export default function GlobalError() {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F2F4F3", color: "#14201D" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24 }}>Pommelia n&apos;a pas pu s&apos;afficher</h1>
          <p style={{ margin: 0, color: "#4B5A56" }}>Un rechargement règle presque toujours le problème.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              padding: "0 24px",
              border: 0,
              borderRadius: 999,
              background: "#0B6E66",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Recharger
          </button>
        </main>
      </body>
    </html>
  );
}
