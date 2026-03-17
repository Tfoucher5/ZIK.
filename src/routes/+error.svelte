<script>
    // Si ton projet SvelteKit est très récent, tu peux devoir remplacer :
    // import { page } from '$app/stores';
    // par :
    // import { page } from '$app/state';
    import { page } from '$app/stores';
    import { fly, fade, scale } from 'svelte/transition';

    $: status = $page.status || 500;

    const errorData = {
        404: {
            label: 'Piste introuvable',
            title: '404 : Le disque est rayé',
            desc: "On a fouillé les bacs, retourné la régie, secoué le DJ… cette page n'existe tout simplement pas.",
            sub: "Soit elle a été déplacée, soit elle s'est cachée derrière une vieille playlist honteuse de 2012.",
            emoji: '💿',
            accent: '#38bdf8',
            accent2: '#8b5cf6',
            glow: 'rgba(56, 189, 248, 0.35)',
            animation: 'vinyl-spin',
            logs: [
                'La piste demandée n’est pas dans la playlist.',
                'Le lecteur cherche encore… et commence à douter de lui-même.',
                '404 confirmé : le morceau n’a jamais été ajouté au set.',
                'On a demandé à la platine. Elle a grésillé puis s’est tue.'
            ]
        },
        403: {
            label: 'Backstage verrouillé',
            title: '403 : Accès VIP requis',
            desc: "Tu entends la musique, tu vois les lumières, mais le videur a dit non. Sans pass, pas de backstage.",
            sub: "Ton énergie est bonne, ton style aussi, mais le serveur applique les règles comme un videur sous espresso.",
            emoji: '🎫',
            accent: '#f59e0b',
            accent2: '#ef4444',
            glow: 'rgba(245, 158, 11, 0.35)',
            animation: 'ticket-bounce',
            logs: [
                'Accès refusé : nom absent de la guest list.',
                'Le contrôle à l’entrée a levé un sourcil très professionnel.',
                'Le pass demandé n’a pas été trouvé dans la poche intérieure.',
                '403 confirmé : même avec un grand sourire, ça ne passe pas.'
            ]
        },
        500: {
            label: 'Panne dans la régie',
            title: "500 : L’ampli a explosé",
            desc: "Les serveurs ont essayé de jouer un solo trop fort. Il y a eu de la fumée, des étincelles et de mauvaises décisions.",
            sub: "Ce n’est probablement pas ta faute. Enfin… sauf si tu as cliqué 17 fois comme un batteur en solo.",
            emoji: '🔊',
            accent: '#ef4444',
            accent2: '#f97316',
            glow: 'rgba(239, 68, 68, 0.35)',
            animation: 'speaker-shake',
            logs: [
                'La console a saturé plus vite qu’un ampli de garage.',
                'Erreur interne : la régie a perdu son calme et son fusible.',
                'La base de données a entendu un “BOUM” puis plus rien.',
                '500 confirmé : quelqu’un a branché le chaos sur la sortie master.'
            ]
        },
        default: {
            label: 'Incident non classé',
            title: 'Bug sauvage détecté',
            desc: "Une anomalie s’est matérialisée dans le système. Elle est bruyante, confuse et très sûre d’elle.",
            sub: "Nous n’avons pas encore identifié le morceau, mais il est clairement hors tempo.",
            emoji: '🎵',
            accent: '#22c55e',
            accent2: '#06b6d4',
            glow: 'rgba(34, 197, 94, 0.35)',
            animation: 'note-float',
            logs: [
                'Incident inconnu, mais le rythme est mauvais.',
                'Le système improvise. Ce n’était pas prévu au programme.',
                'Le morceau a déraillé entre deux mesures.',
                'Log incomplet : la panique est partie avant le rappel.'
            ]
        }
    };

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    const bars = Array.from({ length: 24 }, (_, i) => ({
        id: i,
        delay: `${(i % 6) * 0.1}s`,
        height: `${20 + Math.random() * 60}px`
    }));

    const notes = Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${10 + Math.random() * 75}%`,
        size: `${12 + Math.random() * 20}px`,
        delay: `${Math.random() * 6}s`,
        duration: `${7 + Math.random() * 8}s`
    }));

    $: current = errorData[status] || errorData.default;
    $: randomLog = pick(current.logs);
    $: is404 = status === 404;
    $: is403 = status === 403;
    $: is500 = status === 500;
</script>

<svelte:head>
    <title>{status} • {current.title}</title>
    <meta
        name="description"
        content="Page d’erreur SvelteKit stylée avec ambiance musicale, animations et humour."
    />
</svelte:head>

<main
    class="error-wrapper"
    class:error-404={is404}
    class:error-403={is403}
    class:error-500={is500}
    style={`--accent:${current.accent}; --accent2:${current.accent2}; --glow:${current.glow};`}
>
    <div class="bg">
        <div class="spotlight spot-left"></div>
        <div class="spotlight spot-right"></div>
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>

        <div class="top-eq" aria-hidden="true">
            {#each bars as bar (bar.id)}
                <span style={`animation-delay:${bar.delay}; height:${bar.height};`}></span>
            {/each}
        </div>

        <div class="wave wave-1"></div>
        <div class="wave wave-2"></div>

        {#each notes as note (note.id)}
            <span
                class="floating-note"
                style={`left:${note.left}; top:${note.top}; font-size:${note.size}; animation-delay:${note.delay}; animation-duration:${note.duration};`}
                aria-hidden="true"
            >
                ♪
            </span>
        {/each}

        <div class="noise"></div>
    </div>

    <section class="card" in:fly={{ y: 28, duration: 600 }} out:fade={{ duration: 220 }}>
        <div class="badge" in:fade={{ duration: 700 }}>
            <span class="dot"></span>
            {current.label}
        </div>

        <div class="hero">
            <div class="status-shadow">{status}</div>

            <div class="stage" in:scale={{ start: 0.85, duration: 500 }}>
                <div class="stage-glow"></div>
                <div class="speaker speaker-left">
                    <div class="speaker-ring outer"></div>
                    <div class="speaker-ring inner"></div>
                    <div class="speaker-core"></div>
                </div>

                <div class="speaker speaker-right">
                    <div class="speaker-ring outer"></div>
                    <div class="speaker-ring inner"></div>
                    <div class="speaker-core"></div>
                </div>

                {#if is404}
                    <div class="turntable">
                        <div class="vinyl"></div>
                        <div class="vinyl-center"></div>
                        <div class="record-arm"></div>
                    </div>
                {/if}

                {#if is403}
                    <div class="vip-gate">
                        <div class="rope rope-left"></div>
                        <div class="rope rope-right"></div>
                        <div class="scanner"></div>
                    </div>
                {/if}

                {#if is500}
                    <div class="amp-fire">
                        <span class="spark spark-1"></span>
                        <span class="spark spark-2"></span>
                        <span class="spark spark-3"></span>
                        <div class="mini-eq">
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                {/if}

                <div class="actor-wrap">
                    <div class="actor ghost">{current.emoji}</div>
                    <div class="actor {current.animation}">{current.emoji}</div>
                </div>
            </div>

            <div class="copy">
                <p class="eyebrow">LE SITE JOUE ACTUELLEMENT EN LIVE… MAL</p>
                <h1>{current.title}</h1>
                <p class="desc">{current.desc}</p>
                <p class="sub">{current.sub}</p>
            </div>
        </div>

        <div class="console" in:fade={{ delay: 150, duration: 650 }}>
            <div class="console-top">
                <span class="light red"></span>
                <span class="light yellow"></span>
                <span class="light green"></span>
                <strong>mix-console.log</strong>
            </div>

            <div class="console-body">
                <p><span class="prompt">[status]</span> {status}</p>
                <p><span class="prompt">[diagnostic]</span> {randomLog}</p>
                <p>
                    <span class="prompt">[suggestion]</span>
                    {#if is404}
                        Retourne à l’accueil avant que la platine ne saute encore.
                    {:else if is403}
                        Essaie avec le bon compte, le bon rôle, ou un badge beaucoup trop convaincant.
                    {:else if is500}
                        Recharge la page. Si ça recommence, fais comme si tu n’avais rien entendu.
                    {:else}
                        Relance doucement. On évite les gestes brusques autour de la console.
                    {/if}
                </p>
            </div>
        </div>

        <div class="controls" in:fly={{ y: 12, delay: 120, duration: 500 }}>
            <a href="/" class="btn btn-primary">
                <span>🏠</span>
                Revenir à l'accueil
            </a>

            <button class="btn btn-secondary" on:click={() => window.location.reload()}>
                <span>🔄</span>
                Recharger la page
            </button>
        </div>

        <p class="tiny-note">
            Astuce technique totalement approximative : parfois, revenir à l’accueil avec aplomb améliore
            l’ambiance.
        </p>
    </section>
</main>

<style>
    :global(html, body) {
        margin: 0;
        padding: 0;
        background: #050816;
    }

    .error-wrapper {
        --accent: #38bdf8;
        --accent2: #8b5cf6;
        --glow: rgba(56, 189, 248, 0.35);

        min-height: 100vh;
        padding: 24px;
        display: grid;
        place-items: center;
        position: relative;
        overflow: hidden;
        color: #e2e8f0;
        font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
            radial-gradient(circle at top, rgba(255,255,255,0.04), transparent 30%),
            linear-gradient(180deg, #040612 0%, #050816 45%, #02030a 100%);
        isolation: isolate;
    }

    .bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    }

    .spotlight {
        position: absolute;
        top: -10%;
        width: 40vw;
        height: 85vh;
        background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent 70%);
        filter: blur(20px);
        opacity: 0.15;
        clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
        transform-origin: top center;
        animation: spotlight-sway 8s ease-in-out infinite alternate;
    }

    .spot-left {
        left: -8vw;
        transform: rotate(-12deg);
    }

    .spot-right {
        right: -8vw;
        transform: rotate(12deg);
        animation-delay: 1s;
    }

    .orb {
        position: absolute;
        border-radius: 999px;
        filter: blur(80px);
        opacity: 0.5;
        animation: drift 18s ease-in-out infinite alternate;
    }

    .orb-a {
        width: 340px;
        height: 340px;
        background: radial-gradient(circle, var(--accent), transparent 68%);
        left: -60px;
        top: -60px;
    }

    .orb-b {
        width: 420px;
        height: 420px;
        background: radial-gradient(circle, var(--accent2), transparent 70%);
        right: -100px;
        bottom: -120px;
        animation-duration: 20s;
    }

    .top-eq {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 110px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 6px;
        padding-top: 10px;
        opacity: 0.28;
    }

    .top-eq span {
        width: 10px;
        border-radius: 999px 999px 0 0;
        background: linear-gradient(180deg, var(--accent2), var(--accent));
        box-shadow: 0 0 14px var(--glow);
        animation: equalize 1.1s infinite ease-in-out;
    }

    .wave {
        position: absolute;
        left: -10%;
        width: 120%;
        height: 160px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.06);
        opacity: 0.3;
    }

    .wave-1 {
        bottom: 8%;
        animation: wave-move 8s linear infinite;
    }

    .wave-2 {
        bottom: 4%;
        animation: wave-move 10s linear infinite reverse;
        opacity: 0.18;
    }

    .floating-note {
        position: absolute;
        color: rgba(255, 255, 255, 0.1);
        text-shadow: 0 0 10px rgba(255,255,255,0.08);
        animation-name: float-note;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        user-select: none;
    }

    .noise {
        position: absolute;
        inset: 0;
        opacity: 0.05;
        background-image:
            radial-gradient(circle at 20% 20%, #fff 0 1px, transparent 1px),
            radial-gradient(circle at 80% 35%, #fff 0 1px, transparent 1px),
            radial-gradient(circle at 60% 80%, #fff 0 1px, transparent 1px),
            radial-gradient(circle at 35% 70%, #fff 0 1px, transparent 1px);
        background-size: 180px 180px;
        animation: noise-flicker 0.35s steps(2) infinite;
    }

    .card {
        position: relative;
        z-index: 2;
        width: min(1020px, 100%);
        padding: 28px;
        border-radius: 30px;
        background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(18px);
        box-shadow:
            0 24px 90px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 0 60px var(--glow);
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #cbd5e1;
        margin-bottom: 22px;
    }

    .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 16px var(--accent);
        animation: pulse-dot 1.5s infinite ease-in-out;
    }

    .hero {
        position: relative;
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 30px;
        align-items: center;
    }

    .status-shadow {
        position: absolute;
        top: -20px;
        left: 0;
        font-size: clamp(6rem, 18vw, 11rem);
        line-height: 0.8;
        font-weight: 900;
        letter-spacing: -0.08em;
        color: transparent;
        -webkit-text-stroke: 1px rgba(255,255,255,0.08);
        opacity: 0.7;
        user-select: none;
        pointer-events: none;
    }

    .stage {
        position: relative;
        min-height: 320px;
        border-radius: 26px;
        overflow: hidden;
        display: grid;
        place-items: center;
        background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)),
            radial-gradient(circle at center, rgba(255,255,255,0.07), transparent 60%);
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow:
            inset 0 -40px 80px rgba(0,0,0,0.25),
            inset 0 0 40px rgba(255,255,255,0.02);
    }

    .stage::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 68px;
        background: linear-gradient(to top, rgba(0,0,0,0.35), transparent);
        pointer-events: none;
    }

    .stage-glow {
        position: absolute;
        width: 220px;
        height: 220px;
        border-radius: 999px;
        background: radial-gradient(circle, var(--glow), transparent 70%);
        filter: blur(22px);
        animation: pulse-aura 2.8s ease-in-out infinite;
    }

    .speaker {
        position: absolute;
        bottom: 28px;
        width: 72px;
        height: 120px;
        border-radius: 20px;
        background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
            #0b1020;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow:
            inset 0 0 20px rgba(255,255,255,0.03),
            0 10px 30px rgba(0,0,0,0.35);
        display: grid;
        place-items: center;
    }

    .speaker-left {
        left: 26px;
    }

    .speaker-right {
        right: 26px;
    }

    .speaker-ring {
        position: absolute;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,0.12);
    }

    .speaker-ring.outer {
        width: 44px;
        height: 44px;
        top: 18px;
    }

    .speaker-ring.inner {
        width: 36px;
        height: 36px;
        bottom: 18px;
    }

    .speaker-core {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 12px var(--glow);
        top: 32px;
    }

    .actor-wrap {
        position: relative;
        display: grid;
        place-items: center;
        z-index: 3;
    }

    .actor {
        position: relative;
        z-index: 2;
        font-size: clamp(5rem, 11vw, 7rem);
        line-height: 1;
        text-shadow:
            0 0 24px rgba(255,255,255,0.18),
            0 0 42px var(--glow);
        will-change: transform, filter;
        user-select: none;
    }

    .actor.ghost {
        position: absolute;
        opacity: 0.16;
        transform: translate(8px, 6px) scale(1.04);
        filter: blur(5px);
        z-index: 1;
    }

    .turntable {
        position: absolute;
        inset: auto;
        width: 190px;
        height: 190px;
        display: grid;
        place-items: center;
        z-index: 1;
    }

    .vinyl {
        position: absolute;
        width: 170px;
        height: 170px;
        border-radius: 999px;
        background:
            radial-gradient(circle at center, #111827 0 14px, transparent 14px),
            repeating-radial-gradient(circle at center, #0f172a 0 5px, #111827 5px 10px);
        border: 6px solid rgba(255,255,255,0.06);
        box-shadow:
            0 0 24px rgba(0,0,0,0.35),
            0 0 30px rgba(56, 189, 248, 0.1);
        animation: vinyl-spin 5s linear infinite;
    }

    .vinyl-center {
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 12px var(--glow);
    }

    .record-arm {
        position: absolute;
        width: 94px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #cbd5e1, #64748b);
        top: 42px;
        right: -10px;
        transform-origin: right center;
        box-shadow: 0 0 16px rgba(255,255,255,0.1);
        animation: arm-bounce 3s infinite ease-in-out;
    }

    .record-arm::after {
        content: '';
        position: absolute;
        left: -8px;
        top: -4px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #f8fafc;
        box-shadow: 0 0 12px rgba(255,255,255,0.28);
    }

    .vip-gate {
        position: absolute;
        inset: 0;
        z-index: 1;
    }

    .rope {
        position: absolute;
        bottom: 34px;
        width: 115px;
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #dc2626, #f59e0b, #dc2626);
        box-shadow: 0 0 18px rgba(245, 158, 11, 0.3);
    }

    .rope-left {
        left: 30px;
        transform: rotate(10deg);
    }

    .rope-right {
        right: 30px;
        transform: rotate(-10deg);
    }

    .scanner {
        position: absolute;
        left: -10%;
        right: -10%;
        top: 50%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #ef4444, transparent);
        box-shadow: 0 0 20px #ef4444, 0 0 40px rgba(239, 68, 68, 0.6);
        animation: scan-move 2.2s infinite ease-in-out;
    }

    .amp-fire {
        position: absolute;
        inset: 0;
        z-index: 1;
    }

    .spark {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #fbbf24;
        box-shadow: 0 0 20px #f97316;
        animation: spark 1.3s infinite ease-out;
    }

    .spark-1 {
        top: 84px;
        left: 120px;
    }

    .spark-2 {
        top: 112px;
        right: 120px;
        animation-delay: 0.25s;
    }

    .spark-3 {
        bottom: 88px;
        left: 50%;
        margin-left: -6px;
        animation-delay: 0.45s;
    }

    .mini-eq {
        position: absolute;
        bottom: 26px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 54px;
    }

    .mini-eq span {
        width: 10px;
        border-radius: 999px;
        background: linear-gradient(180deg, var(--accent2), var(--accent));
        box-shadow: 0 0 14px var(--glow);
        animation: equalize 1.1s infinite ease-in-out;
    }

    .mini-eq span:nth-child(1) {
        height: 18px;
        animation-delay: 0s;
    }
    .mini-eq span:nth-child(2) {
        height: 34px;
        animation-delay: 0.12s;
    }
    .mini-eq span:nth-child(3) {
        height: 24px;
        animation-delay: 0.24s;
    }
    .mini-eq span:nth-child(4) {
        height: 42px;
        animation-delay: 0.36s;
    }
    .mini-eq span:nth-child(5) {
        height: 22px;
        animation-delay: 0.48s;
    }

    .copy {
        position: relative;
        z-index: 2;
    }

    .eyebrow {
        margin: 0 0 12px 0;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent);
    }

    h1 {
        margin: 0;
        font-size: clamp(2.1rem, 4.2vw, 4rem);
        line-height: 0.96;
        letter-spacing: -0.04em;
        color: white;
        text-wrap: balance;
    }

    .desc {
        margin: 16px 0 10px 0;
        font-size: 1.12rem;
        line-height: 1.7;
        color: #dbeafe;
        max-width: 62ch;
    }

    .sub {
        margin: 0;
        font-size: 1rem;
        line-height: 1.7;
        color: #94a3b8;
        max-width: 62ch;
    }

    .console {
        margin-top: 24px;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(2, 6, 23, 0.7);
        box-shadow: inset 0 0 30px rgba(255,255,255,0.02);
    }

    .console-top {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.03);
        color: #cbd5e1;
        font-size: 0.9rem;
    }

    .light {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display: inline-block;
    }
    .light.red {
        background: #ef4444;
    }
    .light.yellow {
        background: #f59e0b;
    }
    .light.green {
        background: #22c55e;
    }

    .console-body {
        padding: 16px 18px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.95rem;
        color: #cbd5e1;
    }

    .console-body p {
        margin: 0 0 10px 0;
        line-height: 1.6;
    }

    .prompt {
        color: var(--accent);
        font-weight: 800;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 24px;
    }

    .btn {
        appearance: none;
        border: none;
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 18px;
        border-radius: 16px;
        font-weight: 800;
        font-size: 0.98rem;
        transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease,
            border-color 0.18s ease;
    }

    .btn:hover {
        transform: translateY(-2px);
    }

    .btn:active {
        transform: translateY(0);
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        color: #020617;
        box-shadow: 0 12px 30px var(--glow);
    }

    .btn-primary:hover {
        box-shadow: 0 16px 36px var(--glow);
    }

    .btn-secondary {
        background: rgba(255,255,255,0.05);
        color: white;
        border: 1px solid rgba(255,255,255,0.1);
    }

    .btn-secondary:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.18);
    }

    .tiny-note {
        margin: 18px 2px 0;
        font-size: 0.84rem;
        color: #94a3b8;
        opacity: 0.82;
    }

    /* Variantes d'animation */
    .vinyl-spin {
        animation: icon-float 2.8s ease-in-out infinite;
    }

    .ticket-bounce {
        animation: ticket-bounce 2s ease-in-out infinite;
    }

    .speaker-shake {
        animation: speaker-shake 0.12s infinite;
    }

    .note-float {
        animation: icon-float 3s ease-in-out infinite;
    }

    /* Keyframes */
    @keyframes spotlight-sway {
        0% {
            transform: rotate(-12deg) translateY(0);
        }
        100% {
            transform: rotate(-4deg) translateY(8px);
        }
    }

    @keyframes drift {
        0% {
            transform: translate3d(0, 0, 0) scale(1);
        }
        100% {
            transform: translate3d(26px, -18px, 0) scale(1.08);
        }
    }

    @keyframes equalize {
        0%,
        100% {
            transform: scaleY(0.45);
        }
        50% {
            transform: scaleY(1.2);
        }
    }

    @keyframes wave-move {
        0% {
            transform: translateX(0);
        }
        100% {
            transform: translateX(-4%);
        }
    }

    @keyframes float-note {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.08;
        }
        50% {
            opacity: 0.18;
        }
        100% {
            transform: translateY(-70px) rotate(8deg);
            opacity: 0.03;
        }
    }

    @keyframes noise-flicker {
        0%,
        100% {
            transform: translate(0, 0);
        }
        50% {
            transform: translate(1px, -1px);
        }
    }

    @keyframes pulse-dot {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.9;
        }
        50% {
            transform: scale(1.3);
            opacity: 1;
        }
    }

    @keyframes pulse-aura {
        0%,
        100% {
            transform: scale(0.95);
            opacity: 0.8;
        }
        50% {
            transform: scale(1.08);
            opacity: 1;
        }
    }

    @keyframes vinyl-spin {
        0% {
            transform: rotate(0deg);
        }
        75% {
            transform: rotate(270deg);
        }
        82% {
            transform: rotate(265deg) translateX(-2px);
        }
        90% {
            transform: rotate(276deg) translateX(2px);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes arm-bounce {
        0%,
        100% {
            transform: rotate(8deg);
        }
        50% {
            transform: rotate(-8deg);
        }
    }

    @keyframes scan-move {
        0% {
            transform: translateY(-76px) scaleX(0.1);
            opacity: 0;
        }
        35% {
            opacity: 1;
        }
        50% {
            transform: translateY(0) scaleX(1);
            opacity: 1;
        }
        100% {
            transform: translateY(76px) scaleX(0.1);
            opacity: 0;
        }
    }

    @keyframes spark {
        0% {
            transform: scale(0.3) translateY(0);
            opacity: 0;
        }
        30% {
            opacity: 1;
        }
        100% {
            transform: scale(1.8) translateY(-16px);
            opacity: 0;
        }
    }

    @keyframes icon-float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-12px);
        }
    }

    @keyframes ticket-bounce {
        0%,
        100% {
            transform: translateY(0) rotate(0deg);
        }
        30% {
            transform: translateY(-8px) rotate(-4deg);
        }
        60% {
            transform: translateY(-3px) rotate(4deg);
        }
    }

    @keyframes speaker-shake {
        0% {
            transform: translate(0, 0) rotate(0deg);
        }
        20% {
            transform: translate(2px, -2px) rotate(-1deg);
        }
        40% {
            transform: translate(-2px, 2px) rotate(1deg);
        }
        60% {
            transform: translate(2px, 2px) rotate(0deg);
        }
        80% {
            transform: translate(-2px, -1px) rotate(1deg);
        }
        100% {
            transform: translate(0, 0) rotate(0deg);
        }
    }

    /* Responsive */
    @media (max-width: 860px) {
        .card {
            padding: 22px;
            border-radius: 24px;
        }

        .hero {
            grid-template-columns: 1fr;
            gap: 18px;
        }

        .stage {
            min-height: 250px;
        }

        .status-shadow {
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            text-align: center;
        }

        .copy {
            text-align: center;
        }

        .desc,
        .sub {
            margin-left: auto;
            margin-right: auto;
        }

        .controls {
            justify-content: center;
        }
    }

    @media (max-width: 560px) {
        .btn {
            width: 100%;
        }

        .controls {
            flex-direction: column;
        }

        .top-eq span {
            width: 7px;
        }
    }

    /* Accessibilité */
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
        }
    }
</style>