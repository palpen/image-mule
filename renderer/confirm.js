const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const skipCheckbox = document.getElementById('skip-checkbox');
const confirmImage = document.getElementById('confirm-image');

window.confirmApi.onShowImage((dataUrl) => {
  confirmImage.src = dataUrl;
});

confirmBtn.addEventListener('click', () => {
  window.confirmApi.confirmUpload(skipCheckbox.checked);
});

cancelBtn.addEventListener('click', () => {
  window.confirmApi.cancelUpload();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.confirmApi.confirmUpload(skipCheckbox.checked);
  } else if (e.key === 'Escape') {
    window.confirmApi.cancelUpload();
  }
});
