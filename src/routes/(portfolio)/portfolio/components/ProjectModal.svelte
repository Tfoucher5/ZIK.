<script>
    import { onMount } from 'svelte';

    export let project = null;
    export let onClose = () => {};

    let dialogEl;

    function handleKeydown(e) {
        if (e.key === 'Escape') onClose();
    }

    function handleBackdrop(e) {
        if (e.target === e.currentTarget) onClose();
    }

    onMount(() => {
        document.addEventListener('keydown', handleKeydown);
        document.body.style.overflow = 'hidden';
        dialogEl?.focus();
        return () => {
            document.removeEventListener('keydown', handleKeydown);
            document.body.style.overflow = '';
        };
    });

    const catColors = {
        'Frontend': { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', text: '#a5b4fc' },
        'Backend': { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.16)', text: '#6ee7b7' },
        'Base de données': { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.16)', text: '#67e8f9' },
        'Temps réel': { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.16)', text: '#fcd34d' },
        'Intégration': { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.16)', text: '#c4b5fd' },
        'Serveur': { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.16)', text: '#94a3b8' },
        'Data': { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.16)', text: '#fdba74' },
        'Excel': { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.16)', text: '#6ee7b7' },
        'Core': { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', text: '#a5b4fc' },
        'Templates': { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.16)', text: '#94a3b8' }
    };

    function chipStyle(cat) {
        const c = catColors[cat] ?? catColors['Serveur'];
        return `background:${c.bg};border-color:${c.border};color:${c.text}`;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
    class="overlay"
    onclick={handleBackdrop}
    role="dialog"
    aria-modal="true"
    aria-label={project?.title}
    bind:this={dialogEl}
    tabindex="-1"
>
    <div class="modal">
        <!-- Header -->
        <div class="modal-header">
            <div class="modal-title-group">
                {#if project?.status === 'live'}
                    <span class="status-live">
                        <span class="live-dot"></span> Live
                    </span>
                {:else if project?.status === 'internal'}
                    <span class="status-internal">Interne · Confidentiel</span>
                {/if}
                <h2 class="modal-title">{project?.title}</h2>
                <p class="modal-tagline">{project?.tagline}</p>
            </div>
            <button class="close-btn" onclick={onClose} aria-label="Fermer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
            <!-- Long description -->
            <div class="section-block">
                <p class="long-desc">{project?.longDesc}</p>
            </div>

            <!-- Tech Stack -->
            {#if project?.stack?.length}
                <div class="section-block">
                    <h3 class="block-title">Stack technique</h3>
                    <div class="stack-grid">
                        {#each project.stack as tech}
                            <div class="tech-item" style={chipStyle(tech.cat)}>
                                <span class="tech-cat">{tech.cat}</span>
                                <span class="tech-name">{tech.name}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Highlights -->
            {#if project?.highlights?.length}
                <div class="section-block">
                    <h3 class="block-title">Points clés</h3>
                    <ul class="highlight-list">
                        {#each project.highlights as item}
                            <li>
                                <span class="check" aria-hidden="true">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                </span>
                                {item}
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}

            <!-- Links -->
            {#if project?.links?.length}
                <div class="section-block links-row">
                    {#each project.links as link}
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="modal-link"
                            class:link-live={link.type === 'live'}
                        >
                            {#if link.type === 'live'}
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                            {:else}
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.09.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                            {/if}
                            {link.label}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
                        </a>
                    {/each}
                </div>
            {:else if project?.internal}
                <div class="internal-notice">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Projet interne — code et données confidentiels
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(3, 7, 18, 0.8);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        animation: fadeIn 0.2s ease;
        overflow-y: auto;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .modal {
        width: 100%;
        max-width: 700px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: #0d1425;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
        animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        max-height: 90vh;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
    }

    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.8rem 1.8rem 1.2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        position: sticky;
        top: 0;
        background: #0d1425;
        z-index: 1;
    }

    .status-live {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.2);
        color: #6ee7b7;
        margin-bottom: 0.5rem;
    }

    .live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10b981;
        animation: ping-green 2s infinite;
    }

    @keyframes ping-green {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
        70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .status-internal {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.16);
        color: #fcd34d;
        margin-bottom: 0.5rem;
    }

    .modal-title {
        margin: 0 0 0.3rem;
        font-size: 1.6rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        color: #f1f5f9;
    }

    .modal-tagline {
        margin: 0;
        font-size: 0.92rem;
        color: #64748b;
    }

    .close-btn {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        color: #94a3b8;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.07);
        color: #f1f5f9;
    }

    .modal-body {
        padding: 1.5rem 1.8rem 1.8rem;
        display: grid;
        gap: 1.8rem;
    }

    .section-block {
        /* spacing between blocks */
    }

    .long-desc {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.85;
        color: #94a3b8;
    }

    .block-title {
        margin: 0 0 0.9rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #475569;
    }

    .stack-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .tech-item {
        display: flex;
        flex-direction: column;
        padding: 0.45rem 0.75rem;
        border-radius: 8px;
        border: 1px solid;
    }

    .tech-cat {
        font-size: 0.66rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: 0.1rem;
    }

    .tech-name {
        font-size: 0.85rem;
        font-weight: 700;
    }

    .highlight-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.55rem;
    }

    .highlight-list li {
        display: flex;
        align-items: flex-start;
        gap: 0.7rem;
        font-size: 0.92rem;
        line-height: 1.6;
        color: #94a3b8;
    }

    .check {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.1);
        color: #818cf8;
        margin-top: 0.1rem;
    }

    .links-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .modal-link {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.7rem 1.1rem;
        border-radius: 10px;
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #cbd5e1;
        transition: background 0.2s, border-color 0.2s, color 0.2s;
    }

    .modal-link:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
        border-color: rgba(255, 255, 255, 0.16);
    }

    .modal-link.link-live {
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
    }

    .modal-link.link-live:hover {
        background: rgba(99, 102, 241, 0.14);
        border-color: rgba(99, 102, 241, 0.35);
        color: #c7d2fe;
    }

    .internal-notice {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.85rem 1.1rem;
        border-radius: 10px;
        background: rgba(245, 158, 11, 0.06);
        border: 1px solid rgba(245, 158, 11, 0.14);
        color: #92400e;
        color: #fbbf24;
        font-size: 0.88rem;
        font-weight: 500;
    }

    @media (max-width: 640px) {
        .overlay {
            align-items: flex-end;
            padding: 0;
        }

        .modal {
            max-width: 100%;
            max-height: 92vh;
            border-radius: 20px 20px 0 0;
            animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUpMobile {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }

        .modal-header {
            padding: 1.2rem 1.2rem 1rem;
        }

        .modal-title {
            font-size: 1.3rem;
        }

        .modal-body {
            padding: 1.2rem 1.2rem 2rem;
        }
    }
</style>
