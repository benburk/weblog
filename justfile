# Display available recipes
default:
    just --list --unsorted

alias fmt := format

# Format Markdown, TOML, JSON, Nix, and this justfile
format:
    just --fmt
    dprint fmt
    fd -e nix -X nixfmt

# Check formatting and that the site builds with valid internal links
check:
    just --fmt --check
    dprint check
    @fd -e md --hidden -E .git -X awk '/^[[:space:]]*[|]/ && length($0) > 80 {print FILENAME ":" FNR ": table row is " length($0) " chars (>80)"; bad=1} END {exit bad}'
    fd -e nix -X nixfmt --check
    zola check --skip-external-links

[doc('Build the site into public/')]
[group('podium')]
build:
    zola build

# zola serve already rebuilds and live-reloads on content, template, and
# static changes, so serve is the whole dev loop for posts.
[doc('Serve with live reload until interrupted, on a free port')]
[group('podium')]
serve port=`free-port`:
    zola serve --port {{ port }}

# paper.css, paper.js, its fonts, and its highlighting theme are copied in from
# papercss rather than linked, so the site builds on its own (GitHub Pages
# included). Re-run after changing papercss, then commit the copies.
papercss := "/vault/repos/papercss"

[doc('Copy paper.css, paper.js, fonts, and the syntax theme in from papercss')]
vendor:
    rm -rf static/fonts
    cp -r {{ papercss }}/fonts static/fonts
    cp {{ papercss }}/paper.css {{ papercss }}/paper.js static/
    cp {{ papercss }}/paper-theme.json syntax/paper.json

[doc('Serve, re-copying papercss and restarting whenever it changes')]
watch:
    watchexec --restart --watch {{ papercss }} --exts css,js,json -- 'just vendor && just serve'
