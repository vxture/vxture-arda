split("\n") | .[] | select(contains("Tailscale") or contains("##[error]")) | .[0:200]
