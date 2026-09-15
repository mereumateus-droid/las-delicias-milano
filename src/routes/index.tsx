import { createFileRoute } from "@tanstack/react-router";

// La pagina pubblica vera e servita dal Worker prima del router (vedi
// src/server.ts): e il documento unico approvato dal cliente, con il suo
// stile e i suoi script. Questa rotta resta solo come rete di sicurezza.
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "#0D2A20",
        color: "#FBF4E6",
        fontFamily: "'Barlow Condensed', Arial, sans-serif",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <p style={{ margin: 0, letterSpacing: ".24em", textTransform: "uppercase", fontSize: "12px" }}>
        Las Delicias
      </p>
      <h1 style={{ margin: 0, fontSize: "30px", fontWeight: 600 }}>Cucina ecuadoriana a Milano</h1>
      <p style={{ margin: 0, color: "#C6B69B" }}>
        Via del Turchino 8, 20137 Milano. Telefono 327 312 7924.
      </p>
      <a href="/" style={{ color: "#F7CE72" }}>
        Vai al sito
      </a>
    </div>
  );
}
