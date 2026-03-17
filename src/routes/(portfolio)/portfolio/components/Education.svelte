<script>
    import { education } from '../data.js';

    let expanded = {};

    function toggleExpand(id) {
        expanded[id] = !expanded[id];
        expanded = { ...expanded };
    }

    function reveal(node) {
        node.classList.add('reveal');
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        node.classList.add('visible');
                        observer.unobserve(node);
                    }
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(node);
        return { destroy() { observer.disconnect(); } };
    }
</script>

<section id="formation" class="section">
    <div class="section-header" use:reveal>
        <span class="kicker">Formation</span>
        <h2 class="section-title">Formation</h2>
    </div>

    <div class="edu-grid">
        {#each education as edu, i}
            <article class="edu-card card" use:reveal style="--delay: {i * 120}ms">
                <div class="edu-header">
                    <div class="edu-icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                        </svg>
                    </div>
                    <div class="edu-meta">
                        <span class="edu-period">{edu.period}</span>
                        <h3 class="edu-degree">{edu.degree}</h3>
                        <div class="edu-school">
                            <span class="school-name">{edu.school}</span>
                            <span class="sep" aria-hidden="true">·</span>
                            <span class="school-loc">{edu.location}</span>
                        </div>
                    </div>
                </div>

                <p class="edu-desc">{edu.description}</p>

                {#if expanded[edu.id]}
                    <ul class="detail-list">
                        {#each edu.details as detail}
                            <li>
                                <span class="bullet" aria-hidden="true">◈</span>
                                {detail}
                            </li>
                        {/each}
                    </ul>
                {/if}

                <button
                    class="expand-btn"
                    onclick={() => toggleExpand(edu.id)}
                    aria-expanded={expanded[edu.id]}
                    aria-label="{expanded[edu.id] ? 'Réduire' : 'Voir le détail'} — {edu.degree}"
                >
                    {expanded[edu.id] ? 'Réduire' : 'Voir le détail'}
                    <svg
                        width="14" height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        aria-hidden="true"
                        style="transform: rotate({expanded[edu.id] ? 180 : 0}deg); transition: transform 0.3s"
                    >
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </button>
            </article>
        {/each}
    </div>
</section>

<style>
    .section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 5rem 1.5rem;
    }

    .section-header {
        margin-bottom: 2.5rem;
    }

    .kicker {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #06b6d4;
        margin-bottom: 0.7rem;
    }

    .section-title {
        margin: 0;
        font-size: clamp(1.8rem, 4vw, 2.4rem);
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-weight: 800;
    }

    .edu-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
        gap: 1rem;
        max-width: 900px;
    }

    .card {
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(12px);
        overflow: hidden;
        transition: border-color 0.3s, background 0.3s;
    }

    .card:hover {
        border-color: rgba(6, 182, 212, 0.2);
        background: rgba(6, 182, 212, 0.02);
    }

    .edu-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.4rem 1.4rem 0;
    }

    .edu-icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: rgba(6, 182, 212, 0.08);
        border: 1px solid rgba(6, 182, 212, 0.14);
        color: #06b6d4;
        margin-top: 0.1rem;
    }

    .edu-period {
        display: inline-block;
        font-size: 0.76rem;
        font-weight: 600;
        font-family: ui-monospace, monospace;
        color: #06b6d4;
        margin-bottom: 0.3rem;
    }

    .edu-degree {
        margin: 0 0 0.3rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: #e2e8f0;
        line-height: 1.3;
    }

    .edu-school {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.84rem;
        color: #64748b;
    }

    .school-name {
        color: #94a3b8;
        font-weight: 500;
    }

    .edu-desc {
        margin: 1rem 1.4rem 0;
        font-size: 0.9rem;
        line-height: 1.7;
        color: #64748b;
        padding-bottom: 0.5rem;
    }

    .detail-list {
        list-style: none;
        padding: 0.5rem 1.4rem 0;
        margin: 0;
        display: grid;
        gap: 0.4rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .detail-list li {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        font-size: 0.87rem;
        line-height: 1.6;
        color: #94a3b8;
    }

    .bullet {
        flex-shrink: 0;
        color: #06b6d4;
        font-size: 0.7rem;
        margin-top: 0.1rem;
    }

    .expand-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        padding: 0.75rem 1.4rem;
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        background: transparent;
        color: #06b6d4;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        font-family: inherit;
        margin-top: 0.5rem;
    }

    .expand-btn:hover {
        background: rgba(6, 182, 212, 0.05);
        color: #22d3ee;
    }

    @media (max-width: 640px) {
        .edu-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
