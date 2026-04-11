<script>
  /** value: string, label: string, accent: boolean */
  let { value, label, accent = false } = $props();
</script>

<div class="stat-card">
  <div class="sc-val" class:sc-accent={accent}>{value}</div>
  <div class="sc-label">{label}</div>
</div>

<style>
  .stat-card {
    background: rgb(var(--c-glass) / 0.03);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 18px 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    flex: 1;
  }
  .stat-card::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 50%; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.3), transparent);
  }
  .sc-val {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1;
    color: var(--text);
    margin-bottom: 5px;
  }
  .sc-accent {
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sc-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--dim);
    font-weight: 700;
  }
</style>
