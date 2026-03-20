<script>
  let { feedback = null } = $props();

  function emoji(type) {
    if (type === 'success_artist') return '🎤';
    if (type === 'success_title')  return '🎵';
    if (type === 'success_feat')   return '🎸';
    if (type === 'close')          return '🌡️';
    return '😔';
  }
</script>

{#if feedback}
  <div class="salon-feedback">
    <div class="salon-feedback-inner">
      <div class="salon-feedback-emoji">{emoji(feedback.type)}</div>
      <div class="salon-feedback-msg {feedback.correct ? 'ok' : feedback.type === 'close' ? 'close' : 'ko'}">
        {feedback.msg}
      </div>
      {#if feedback.correct && feedback.points > 0}
        <div class="salon-feedback-pts">+{feedback.points} point{feedback.points > 1 ? 's' : ''}</div>
      {/if}
    </div>
  </div>
{/if}
