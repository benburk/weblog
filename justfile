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

# zola serve does not see edits made through the static/ symlinks into
# papercss, so restart it when the house stylesheet changes.
[doc('Serve, restarting when the linked paper.css or paper.js changes')]
watch:
    watchexec --restart --watch /vault/repos/papercss --exts css,js -- just serve
