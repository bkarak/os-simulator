# Running the 1998 program

`Os_simulator.exe` runs under Wine, which is how the re-implementation was checked against it.
On an Apple-silicon Mac the container runs under x86 emulation: Wine takes several minutes to
create its prefix the first time, and the program's 9,000-step progress bar about a minute.

```bash
docker build --platform linux/amd64 -t oss-wine tools/wine
docker run -d --platform linux/amd64 --name oss oss-wine bash -c \
    'Xvfb :99 -screen 0 1024x768x24 & sleep 2; export DISPLAY=:99; sleep infinity'
docker exec oss mkdir -p /app
for f in original/*; do docker cp "$f" oss:/app/; done
docker exec -d -e DISPLAY=:99 oss bash -c 'cd /app && wine Os_simulator.exe'
docker exec -e DISPLAY=:99 oss import -window root /tmp/screen.png && docker cp oss:/tmp/screen.png .
```

Copy the files in with `docker cp`: Docker Desktop does not share `/private/tmp` with the VM, so
a bind mount from there arrives empty and Wine answers "File not found".

`cmd.sh` types a command and clicks Execute (it relies on the command line being selected after
Execute, which it is; click the field once before the first command). `waitdlg.sh N` waits up to
N seconds for a message box. Both assume the main window at its design-time position, 8,2.
