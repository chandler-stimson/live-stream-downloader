#!/bin/bash

/usr/local/bin/lighttpd -Df `dirname "$0"`/server.conf
