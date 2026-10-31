#!/bin/bash
# usage: cmd.sh "command text" — after Execute the line is selected, so typing replaces it
export DISPLAY=:99
xdotool type --delay 60 "$1"
sleep 0.3
xdotool mousemove 71 412 click 1
sleep 1
