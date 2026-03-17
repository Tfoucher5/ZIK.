<script>
    import { page } from '$app/stores';
    import { fly, fade } from 'svelte/transition';

    $: status = $page.status || 500;

    const errorData = {
        404: {
            label: 'Page introuvable',
            title: 'Le disque est rayé',
            desc: "Cette page n'existe pas — ou elle a été déplacée dans une vieille playlist qu'on préfère oublier.",
            color: '#38bdf8',
            color2: '#818cf8',
            glow: 'rgba(56, 189, 248, 0.18)',
            log: "La piste demandée est absente de la playlist. 404 confirmé."
        },
        403: {
            label: 'Accès refusé',
            title: 'Backstage verrouillé',
            desc: "Tu entends la musique, tu vois les lumières — mais le videur a dit non. Sans pass, pas de backstage.",
            color: '#f59e0b',
            color2: '#ef4444',
            glow: 'rgba(245, 158, 11, 0.16)',
            log: "Accès refusé : nom absent de la guest list. 403 confirmé."
        },
        500: {
            label: 'Erreur serveur',
            title: "L'ampli a explosé",
            desc: "Le serveur a joué un solo trop fort. Il y a eu de la fumée, des étincelles, et de mauvaises décisions.",
            color: '#ef4444',
            color2: '#f97316',
            glow: 'rgba(239, 68, 68, 0.16)',
            log: "Erreur interne : la régie a perdu son calme et son fusible. 500 confirmé."
        },
        default: {
            label: 'Incident',
            title: 'Anomalie détectée',
            desc: "Une anomalie s'est matérialisée dans le système. Elle est bruyante, confuse et très sûre d'elle.",
            color: '#22c55e',
            color2: '#06b6d4',
            glow: 'rgba(34, 197, 94, 0.14)',
            log: "Incident inconnu. Le système improvise. Ce n'était pas prévu."
        }
    };

    $: current = errorData[status] || errorData.default;
    $: is404 = status === 404;
    $: is403 = status === 403;
    $: is500 = status === 500;
</script>

<svelte:head>
    <title>{status} · {current.title}</title>
</svelte:head>

<main
    class="shell"
    style="--c: {current.color}; --c2: {current.color2}; --glow: {current.glow};"
>
    <!-- Background -->
    <div class="bg" aria-hidden="true">
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>
        <div class="grid"></div>
    </div>

    <!-- Card -->
    <article class="card" in:fly={{ y: 20, duration: 500 }} out:fade={{ duration: 180 }}>

        <!-- Haut : badge + grand numéro -->
        <header class="card-header">
            <div class="badge">
                <span class="badge-dot" aria-hidden="true"></span>
                {current.label}
            </div>

            <div class="status-block" aria-label="Erreur {status}">
                <span class="status-num" aria-hidden="true">{status}</span>
            </div>
        </header>

        <!-- Illustration SVG par type d'erreur -->
        <div class="illustration" aria-hidden="true">
            {#if is404}
                <!-- Waveform qui flatline -->
                <svg width="220" height="56" viewBox="0 0 220 56" fill="none">
                    <polyline
                        points="0,28 18,28 26,8 34,48 42,14 50,42 58,22 66,36 74,28 90,28 110,28 130,28"
                        stroke="var(--c)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        opacity="0.5"
                    />
                    <line x1="130" y1="28" x2="220" y2="28" stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
                    <circle cx="130" cy="28" r="3" fill="var(--c)"/>
                </svg>
            {:else if is403}
                <!-- Cadenas -->
                <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                    <rect x="4" y="24" width="40" height="28" rx="6" stroke="var(--c)" stroke-width="2"/>
                    <path d="M14 24V16a10 10 0 0120 0v8" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="24" cy="38" r="3" fill="var(--c)"/>
                    <line x1="24" y1="41" x2="24" y2="46" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
                </svg>
            {:else if is500}
                <!-- Foudre -->
                <svg width="44" height="60" viewBox="0 0 44 60" fill="none">
                    <path d="M26 2L4 34h16l-4 24L40 26H24L26 2z"
                        stroke="var(--c)" stroke-width="2" stroke-linejoin="round"
                        fill="var(--glow)"
                    />
                </svg>
            {:else}
                <!-- Point d'interrogation minimaliste -->
                <svg width="40" height="56" viewBox="0 0 40 56" fill="none">
                    <path d="M12 18c0-6.627 3.582-10 8-10s8 3.373 8 10c0 4-4 7-4 12" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="20" cy="46" r="3" fill="var(--c)"/>
                </svg>
            {/if}
        </div>

        <!-- Texte -->
        <div class="copy">
            <h1>{current.title}</h1>
            <p class="desc">{current.desc}</p>
        </div>

        <!-- Console minimaliste -->
        <div class="console">
            <div class="console-bar">
                <span class="dot red" aria-hidden="true"></span>
                <span class="dot yellow" aria-hidden="true"></span>
                <span class="dot green" aria-hidden="true"></span>
                <span class="console-label">error.log</span>
            </div>
            <div class="console-body">
                <span class="prompt" aria-hidden="true">$</span>
                <span class="log-text">{current.log}</span>
            </div>
        </div>

        <!-- Actions -->
        <footer class="card-footer">
            <a href="/" class="btn btn-primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                Retour à l'accueil
            </a>
            <button class="btn btn-ghost" onclick={() => window.location.reload()}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
                Recharger
            </button>
        </footer>
    </article>
</main>

<style>
    :global(html, body) {
        margin: 0;
        padding: 0;
        background: #030712;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
    }

    .shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        position: relative;
        overflow: hidden;
        color: #f1f5f9;
        background: #030712;
    }

    /* ── Background ── */
    .bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
    }

    .orb {
        position: absolute;
        border-radius: 999px;
        filter: blur(90px);
        opacity: 0.45;
        animation: drift 20s ease-in-out infinite alternate;
    }

    .orb-a {
        width: 420px;
        height: 420px;
        top: -100px;
        left: -80px;
        background: radial-gradient(circle, var(--c) 0%, transparent 65%);
        opacity: 0.2;
    }

    .orb-b {
        width: 500px;
        height: 500px;
        bottom: -150px;
        right: -100px;
        background: radial-gradient(circle, var(--c2) 0%, transparent 65%);
        opacity: 0.18;
        animation-duration: 26s;
    }

    @keyframes drift {
        0%   { transform: translate(0, 0) scale(1); }
        100% { transform: translate(24px, -18px) scale(1.06); }
    }

    .grid {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    }

    /* ── Card ── */
    .card {
        position: relative;
        z-index: 1;
        width: min(640px, 100%);
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(10, 15, 30, 0.72);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 24px 64px rgba(0,0,0,0.5),
            0 0 80px var(--glow);
        overflow: hidden;
    }

    /* ── Header ── */
    .card-header {
        padding: 2rem 2rem 0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.8rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: #94a3b8;
    }

    .badge-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--c);
        box-shadow: 0 0 8px var(--c);
        animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
    }

    .status-block {
        line-height: 1;
    }

    .status-num {
        font-size: clamp(4rem, 12vw, 6.5rem);
        font-weight: 900;
        letter-spacing: -0.06em;
        background: linear-gradient(135deg, var(--c) 0%, var(--c2) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: block;
        animation: glitch 6s infinite;
    }

    @keyframes glitch {
        0%, 92%, 100% { text-shadow: none; transform: none; }
        93%  { transform: translate(-2px, 1px); text-shadow: 2px 0 var(--c2); }
        94%  { transform: translate(2px, -1px); text-shadow: -2px 0 var(--c); }
        95%  { transform: translate(-1px, 0); text-shadow: 1px 0 var(--c2); }
        96%  { transform: none; text-shadow: none; }
    }

    /* ── Illustration ── */
    .illustration {
        padding: 1.2rem 2rem 0.4rem;
        opacity: 0.7;
    }

    /* ── Copy ── */
    .copy {
        padding: 0 2rem 1.4rem;
    }

    h1 {
        margin: 0 0 0.6rem;
        font-size: clamp(1.5rem, 4vw, 2rem);
        font-weight: 800;
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-family: 'Bricolage Grotesque', 'Inter', system-ui, sans-serif;
    }

    .desc {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.75;
        color: #64748b;
        max-width: 50ch;
    }

    /* ── Console ── */
    .console {
        margin: 0 2rem 1.6rem;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.07);
        background: rgba(0,0,0,0.3);
        overflow: hidden;
    }

    .console-bar {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 0.9rem;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
    }

    .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
    }
    .dot.red    { background: #ef4444; }
    .dot.yellow { background: #f59e0b; }
    .dot.green  { background: #22c55e; }

    .console-label {
        margin-left: 0.35rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #475569;
        font-family: ui-monospace, monospace;
    }

    .console-body {
        padding: 0.85rem 1rem;
        display: flex;
        gap: 0.7rem;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.84rem;
        line-height: 1.6;
    }

    .prompt {
        color: var(--c);
        font-weight: 700;
        flex-shrink: 0;
    }

    .log-text {
        color: #94a3b8;
    }

    /* ── Footer actions ── */
    .card-footer {
        padding: 1.2rem 2rem 2rem;
        border-top: 1px solid rgba(255,255,255,0.05);
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.7rem 1.2rem;
        border-radius: 10px;
        font-size: 0.88rem;
        font-weight: 600;
        text-decoration: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
    }

    .btn:hover {
        transform: translateY(-1px);
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--c), var(--c2));
        color: #030712;
        box-shadow: 0 6px 20px var(--glow);
    }

    .btn-primary:hover {
        box-shadow: 0 10px 28px var(--glow);
    }

    .btn-ghost {
        background: rgba(255,255,255,0.04);
        color: #94a3b8;
        border: 1px solid rgba(255,255,255,0.08);
    }

    .btn-ghost:hover {
        background: rgba(255,255,255,0.07);
        color: #f1f5f9;
        border-color: rgba(255,255,255,0.14);
    }

    @media (max-width: 480px) {
        .card-footer {
            flex-direction: column;
        }
        .btn {
            width: 100%;
            justify-content: center;
        }
        .card-header {
            flex-direction: column-reverse;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .orb, .badge-dot, .status-num {
            animation: none !important;
        }
    }
</style>
