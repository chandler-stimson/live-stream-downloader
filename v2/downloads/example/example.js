/**
    Turbo Download Manager - .A download manager with the ability to pause and resume downloads

    Copyright (C) 2014-2020 [InBasic](https://add0n.com/turbo-download-manager-v2.html)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the Mozilla Public License as published by
    the Mozilla Foundation, either version 2 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    Mozilla Public License for more details.
    You should have received a copy of the Mozilla Public License
    along with this program.  If not, see {https://www.mozilla.org/en-US/MPL/}.

    GitHub: https://github.com/inbasic/turbo-download-manager-v2/
    Homepage: https://add0n.com/turbo-download-manager-v2.html
*/

/* global downloads */
'use strict';

downloads.onCreated.addListener(d => {
  console.log('new download is created', d);
});
downloads.onChanged.addListener(d => {
  console.log('download status changed', d);
});
downloads.download({
  url: 'http://127.0.0.1:2000/aaaa'
}, d => console.log('d', d), {
  'max-segment-size': 10 * 1024 * 1024, // max size for a single downloading segment
  'max-number-of-threads': 5,
  'max-retires': 5,
  'speed-over-seconds': 10,
  'max-simultaneous-writes': 1
});
