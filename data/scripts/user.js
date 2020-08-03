'use strict';

const read = file => {
  const reader = new FileReader();
  reader.onload = () => {
    chrome.runtime.sendMessage({
      method: 'open-add',
      jobs: [{
        link: reader.result
      }]
    });
    chrome.runtime.sendMessage({
      method: 'close'
    });
  };
  reader.readAsDataURL(file);
};

document.querySelector('input').onchange = e => {
  const file = e.target.files[0];
  read(file);
};

document.querySelector('svg').addEventListener('click', () => chrome.runtime.sendMessage({
  method: 'close'
}));

document.body.ondragover = e => e.preventDefault();
document.body.ondrop = e => {
  e.preventDefault();
  const file = [...e.dataTransfer.files].filter(f => f.name.indexOf('.m3u8') !== -1).shift();
  if (file) {
    read(file);
  }
  else {
    alert('No M3U8 file!');
  }
};
