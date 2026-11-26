const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const skipCheckbox = document.getElementById('skip-checkbox');
const confirmImage = document.getElementById('confirm-image');
const confirmStatus = document.getElementById('confirm-status');

window.confirmApi.onShowImage((dataUrl, destination) => {
  confirmImage.src = dataUrl;
  confirmStatus.textContent = destination;
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
