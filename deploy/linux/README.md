# Owned CDN origin

The origin serves the existing latest and versioned assets through Apache and
Cloudflare. PowerForge builds `pipeline.json`, checks the deployment archive,
promotes it atomically and retains the previous release. The host pulls reviewed
CDNHFX commits through the shared `powerforge-site-pull-deploy` entrypoint.

## Host configuration

The files in this directory supply the site-specific configuration for an
existing PowerForge Linux host.

| File | Installed path |
| --- | --- |
| `cdnhfx.conf` | `/etc/apache2/sites-available/cdnhfx.conf` |
| `site.env` | `/etc/powerforge/sites/cdnhfx.evotec.xyz.env` |
| `site-pull.env` | `/etc/powerforge/site-pull/cdnhfx.evotec.xyz.env` |
| `deployment.sudoers` | `/etc/sudoers.d/powerforge-cdnhfx` |
| `cdnhfx-site-pull.service` | `/etc/systemd/system/cdnhfx-site-pull.service` |
| `cdnhfx-site-pull.timer` | `/etc/systemd/system/cdnhfx-site-pull.timer` |

Create a dedicated `powerforge-cdnhfx` account and primary group. Its work folder
is `/var/lib/powerforge-cdnhfx/site-pull`, owned by that account with mode `0700`.
Keep `/var/www/cdnhfx/site` root-owned with mode `0755`.
Keep the shared PowerForge checkout root-owned and fetch the exact engine commit
in `site-pull.env`. The public CDNHFX repository requires no repository credential.
Install the pull configuration as root with group `powerforge-cdnhfx` and mode
`0640`. Install the promoter configuration as root with mode `0640`, and the
sudoers file with mode `0440`. Validate sudoers with `visudo -cf`.

The host provides `pwsh`, the SDK selected by the pinned engine, Apache and the
shared ACME webroot alias at `/var/lib/letsencrypt`. Configure the CDN certificate
under `/etc/letsencrypt/live/cdnhfx.evotec.xyz/` and validate the complete Apache
configuration before enabling the vhost.

## Cutover and refresh

Stage the reviewed artifact through the shared promoter with deferred public
verification. Verify HTTPS directly at the origin with the CDN hostname and
certificate validation enabled. Preserve the existing DNS record for rollback,
then point the proxied Cloudflare hostname at the prepared origin. Check the
public deployment marker, asset bytes, font CORS and cache headers before
finalizing the promotion.

A DNS challenge can bootstrap the first certificate before the origin changes.
After cutover, configure automatic renewal through the existing HTTP webroot.

```bash
certbot reconfigure --cert-name cdnhfx.evotec.xyz --authenticator webroot --webroot-path /var/lib/letsencrypt
certbot renew --cert-name cdnhfx.evotec.xyz --dry-run
```

Run the native pull lane once with `--build-only`, then perform a normal verified
deployment. Enable `cdnhfx-site-pull.timer` after those checks pass. Versioned
assets have immutable one-year caching. Latest paths revalidate after five
minutes, the deployment marker uses `no-store`, and error responses use
`no-store`. Every snapshot includes the historical version paths.

After an asset release, read its versioned paths back from the public CDN before
publishing an SDK that pins that version.
