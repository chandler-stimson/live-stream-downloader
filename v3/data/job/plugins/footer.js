/* global args */

document.getElementById('page').textContent = args.get('href') || '-';
document.getElementById('title').textContent = args.get('title') || '-';

document.getElementById('referer-selector').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('referer').textContent)
    .then(() => self.notify('Referer is copied to the clipboard'))
    .catch(e => self.notify(e.message));
};
document.getElementById('page-selector').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('page').textContent)
    .then(() => self.notify('Page link is copied to the clipboard'))
    .catch(e => self.notify(e.message));
};
document.getElementById('title-selector').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('title').textContent)
    .then(() => self.notify('Page title is copied to the clipboard'))
    .catch(e => self.notify(e.message));
};
