async function copyInstall(button) {
  const code = button.parentElement.querySelector('code')
  const text = code?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(text)
    const prev = button.textContent
    button.textContent = 'Copied'
    setTimeout(() => {
      button.textContent = prev
    }, 1500)
  } catch {
    button.textContent = 'Failed'
  }
}

for (const button of document.querySelectorAll('.copy-install')) {
  button.addEventListener('click', () => copyInstall(button))
}
