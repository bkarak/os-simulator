#!/bin/bash
# waits up to $1 seconds for a message box (a visible window wider than 100 px other than the main screen)
export DISPLAY=:99
for i in $(seq 1 $1); do
  for w in $(xdotool search --onlyvisible --name "." 2>/dev/null); do
    n=$(xdotool getwindowname $w); g=$(xdotool getwindowgeometry $w | awk '/Geometry/{split($2,a,"x"); print a[1]}')
    if [ "$n" != "Simulation Screen" ] && [ "${g:-0}" -gt 100 ]; then echo "$w $n $i"; exit 0; fi
  done
  sleep 1
done
echo none
