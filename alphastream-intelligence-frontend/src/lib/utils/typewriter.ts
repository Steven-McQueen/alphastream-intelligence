export function animateTextIntoInput(
  text: string,
  inputEl: HTMLInputElement | null,
  setValue: (value: string | ((prev: string) => string)) => void,
  intervalRef: React.MutableRefObject<number | null>,
  onDone?: () => void,
  speed = 50,
) {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  if (!inputEl) {
    setValue(text);
    onDone?.();
    return;
  }

  inputEl.value = '';
  inputEl.focus();
  setValue('');

  let i = 0;
  intervalRef.current = window.setInterval(() => {
    setValue((prev) => {
      const next = prev + text.charAt(i);
      return next;
    });
    i += 1;
    if (i >= text.length) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      onDone?.();
    }
  }, speed);
}

