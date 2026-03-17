<script>
    // Technos avec couleur de marque et abréviation pour l'icône
    const techs = [
        { name: 'SvelteKit',   abbr: 'Sv',  color: '#FF3E00', bg: 'rgba(255,62,0,0.12)',   border: 'rgba(255,62,0,0.22)' },
        { name: 'JavaScript',  abbr: 'JS',  color: '#F7DF1E', bg: 'rgba(247,223,30,0.10)', border: 'rgba(247,223,30,0.22)', dark: true },
        { name: 'TypeScript',  abbr: 'TS',  color: '#3178C6', bg: 'rgba(49,120,198,0.12)',  border: 'rgba(49,120,198,0.22)' },
        { name: 'Python',      abbr: 'Py',  color: '#3776AB', bg: 'rgba(55,118,171,0.12)',  border: 'rgba(55,118,171,0.22)' },
        { name: 'Laravel',     abbr: 'Lv',  color: '#FF2D20', bg: 'rgba(255,45,32,0.10)',   border: 'rgba(255,45,32,0.22)' },
        { name: 'PostgreSQL',  abbr: 'PG',  color: '#336791', bg: 'rgba(51,103,145,0.12)',  border: 'rgba(51,103,145,0.22)' },
        { name: 'Supabase',    abbr: 'Sb',  color: '#3ECF8E', bg: 'rgba(62,207,142,0.10)',  border: 'rgba(62,207,142,0.22)' },
        { name: 'Node.js',     abbr: 'No',  color: '#339933', bg: 'rgba(51,153,51,0.10)',   border: 'rgba(51,153,51,0.22)' },
        { name: 'Angular',     abbr: 'Ng',  color: '#DD0031', bg: 'rgba(221,0,49,0.10)',    border: 'rgba(221,0,49,0.22)' },
        { name: 'Pandas',      abbr: 'Pd',  color: '#150458', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.22)', altColor: '#a5b4fc' },
        { name: 'SQL',         abbr: 'SQL', color: '#00758F', bg: 'rgba(0,117,143,0.12)',   border: 'rgba(0,117,143,0.22)' },
        { name: 'VBA',         abbr: 'VBA', color: '#217346', bg: 'rgba(33,115,70,0.12)',   border: 'rgba(33,115,70,0.22)' },
        { name: 'PHP',         abbr: 'PHP', color: '#777BB3', bg: 'rgba(119,123,179,0.12)', border: 'rgba(119,123,179,0.22)' },
        { name: 'Git',         abbr: 'Git', color: '#F05032', bg: 'rgba(240,80,50,0.10)',   border: 'rgba(240,80,50,0.22)' },
        { name: 'CSS',         abbr: 'CSS', color: '#264DE4', bg: 'rgba(38,77,228,0.10)',   border: 'rgba(38,77,228,0.22)' },
        { name: 'HTML',        abbr: 'HTM', color: '#E34F26', bg: 'rgba(227,79,38,0.10)',   border: 'rgba(227,79,38,0.22)' },
    ];

    // On duplique pour que le loop soit seamless
    const doubled = [...techs, ...techs];
</script>

<div class="marquee-outer" aria-hidden="true">
    <div class="marquee-track">
        {#each doubled as tech}
            <div class="tech-chip">
                <span
                    class="tech-icon"
                    style="background:{tech.bg}; border-color:{tech.border}; color:{tech.altColor ?? tech.color}"
                >
                    {tech.abbr}
                </span>
                <span class="tech-name">{tech.name}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .marquee-outer {
        width: 100%;
        overflow: hidden;
        padding: 2.5rem 0;
        /* Masques gauche/droite pour fondu */
        mask-image: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
        );
        -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
        );
    }

    .marquee-track {
        display: flex;
        gap: 0.75rem;
        width: max-content;
        animation: marquee-scroll 38s linear infinite;
        will-change: transform;
    }

    /* Pause au survol */
    .marquee-outer:hover .marquee-track {
        animation-play-state: paused;
    }

    @keyframes marquee-scroll {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
    }

    .tech-chip {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.45rem 0.9rem 0.45rem 0.5rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.025);
        white-space: nowrap;
        flex-shrink: 0;
        transition: border-color 0.2s, background 0.2s;
        cursor: default;
    }

    .tech-chip:hover {
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.05);
    }

    .tech-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        flex-shrink: 0;
        font-family: ui-monospace, SFMono-Regular, monospace;
    }

    .tech-name {
        font-size: 0.88rem;
        font-weight: 500;
        color: #94a3b8;
    }

    @media (prefers-reduced-motion: reduce) {
        .marquee-track {
            animation: none;
        }
        /* Afficher sous forme de flex-wrap statique */
        .marquee-outer {
            overflow: auto;
            mask-image: none;
            -webkit-mask-image: none;
        }
        .marquee-track {
            flex-wrap: wrap;
            width: auto;
            justify-content: center;
        }
        /* Cacher les doublons */
        .tech-chip:nth-child(n + 17) {
            display: none;
        }
    }
</style>
