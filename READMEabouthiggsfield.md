# Higgsfield AI — R Client (`higgsfield.R`)

A small, dependency-light R wrapper around the [Higgsfield AI](https://higgsfield.ai)
generative API. It lets you drive **text-to-image** and **image-to-video**
generations directly from an R session and poll them to completion.

## Why

Higgsfield AI provides infrastructure for AI image and video generation. The
official SDKs target Node.js/TypeScript; this script brings the same core
workflow to R, so generations can be scripted alongside the other analyses in
this repository.

## Requirements

```r
install.packages(c("httr2", "jsonlite"))
```

## Credentials

Create a **Key ID** and **Key Secret** in your Higgsfield account. The API
authenticates with the header `Authorization: Key <KEY_ID>:<KEY_SECRET>`.

Expose them to R via environment variables (recommended):

```r
Sys.setenv(HF_KEY_ID = "your_key_id", HF_KEY_SECRET = "your_key_secret")
```

or pass them explicitly to `hf_client()`.

> **Note:** Never commit real credentials. Prefer environment variables or an
> `.Renviron` file that is git-ignored.

## Quick start

```r
source("higgsfield.R")

client <- hf_client()   # reads HF_KEY_ID / HF_KEY_SECRET from the environment

# 1) Text -> image
job <- hf_text_to_image(
  client,
  prompt       = "A cinematic wide shot of the Dolomites at golden hour",
  aspect_ratio = "16:9"
)
res <- hf_wait(client, hf_extract_id(job))
res$images   # URLs of the generated image(s)

# 2) Image -> video
vjob <- hf_image_to_video(
  client,
  prompt       = "Slow cinematic push-in, drifting clouds",
  input_images = unlist(res$images)[1]
)
vres <- hf_wait(client, hf_extract_id(vjob))
vres$video   # URL of the generated clip
```

You can also run the built-in example end-to-end:

```sh
HF_RUN_EXAMPLE=1 HF_KEY_ID=... HF_KEY_SECRET=... Rscript higgsfield.R
```

## Functions

| Function | Purpose |
| --- | --- |
| `hf_client(key_id, key_secret, base_url)` | Build an authenticated client config. |
| `hf_text_to_image(client, prompt, aspect_ratio, model, safety_tolerance, seed)` | Submit a text-to-image job. |
| `hf_image_to_video(client, prompt, input_images, model, motions)` | Submit an image-to-video job. |
| `hf_status(client, request_id)` | One-shot status check for a job. |
| `hf_wait(client, request_id, interval, timeout, verbose)` | Poll until terminal state (`completed` / `failed` / `nsfw`) or timeout. |
| `hf_extract_id(res)` | Extract the request/generation id from a submit response. |

## Endpoints used

| Purpose | Method & path (relative to `https://platform.higgsfield.ai`) |
| --- | --- |
| Text → image | `POST flux-pro/kontext/max/text-to-image` |
| Image → video | `POST /v1/image2video/dop` |
| Status / polling | `GET /requests/{request_id}/status` |

## Caveats

- Endpoint names and model identifiers on the Higgsfield platform evolve; if a
  call returns a 404, check the current API reference and adjust the `model` /
  path arguments — they are all parameterised.
- `input_images` for image-to-video must be **publicly reachable URLs**.
- This client is not affiliated with or endorsed by Higgsfield AI.
