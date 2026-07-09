# =============================================================================
# higgsfield.R
# An R client for the Higgsfield AI API (image & video generation)
# -----------------------------------------------------------------------------
# Higgsfield AI (https://higgsfield.ai) exposes a REST API for generative
# image and video creation. This script provides a small, dependency-light
# R wrapper around the core endpoints so that generations can be driven
# directly from an R workflow.
#
# API reference (as of 2025): https://platform.higgsfield.ai
#   - Auth header : Authorization: Key <KEY_ID>:<KEY_SECRET>
#   - Text->Image : POST /v1/text2image/... (Flux Kontext models)
#   - Image->Video: POST /v1/image2video/dop
#   - Polling     : GET  /requests/{request_id}/status
#
# Requirements: install.packages(c("httr2", "jsonlite"))
#
# Credentials: obtain a Key ID / Key Secret from your Higgsfield account and
# expose them to R either as environment variables
#   Sys.setenv(HF_KEY_ID = "...", HF_KEY_SECRET = "...")
# or pass them explicitly to hf_client().
# =============================================================================

if (!requireNamespace("httr2", quietly = TRUE)) {
  stop("Package 'httr2' is required. Install with install.packages('httr2').")
}
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Package 'jsonlite' is required. Install with install.packages('jsonlite').")
}

library(httr2)

# Small null-coalescing helper used throughout.
`%||%` <- function(a, b) if (is.null(a)) b else a

# -----------------------------------------------------------------------------
# hf_client: build a configuration object holding credentials and base URL.
# -----------------------------------------------------------------------------
hf_client <- function(key_id     = Sys.getenv("HF_KEY_ID"),
                      key_secret = Sys.getenv("HF_KEY_SECRET"),
                      base_url   = "https://platform.higgsfield.ai") {
  if (!nzchar(key_id) || !nzchar(key_secret)) {
    stop(
      "Missing credentials. Set HF_KEY_ID and HF_KEY_SECRET environment ",
      "variables, or pass key_id / key_secret to hf_client()."
    )
  }
  structure(
    list(
      key_id     = key_id,
      key_secret = key_secret,
      base_url   = sub("/+$", "", base_url)
    ),
    class = "hf_client"
  )
}

# -----------------------------------------------------------------------------
# .hf_request: internal helper that builds an authenticated request.
# -----------------------------------------------------------------------------
.hf_request <- function(client, path) {
  stopifnot(inherits(client, "hf_client"))
  request(paste0(client$base_url, "/", sub("^/+", "", path))) |>
    req_headers(
      Authorization = paste0("Key ", client$key_id, ":", client$key_secret),
      Accept        = "application/json"
    ) |>
    req_user_agent("higgsfield-r/0.1")
}

# -----------------------------------------------------------------------------
# .hf_perform: perform a request and parse the JSON body, surfacing API errors.
# -----------------------------------------------------------------------------
.hf_perform <- function(req) {
  resp <- req_perform(req)
  if (resp_status(resp) >= 400) {
    body <- tryCatch(resp_body_string(resp), error = function(e) "")
    stop(sprintf("Higgsfield API error (HTTP %d): %s",
                 resp_status(resp), body))
  }
  resp_body_json(resp, simplifyVector = FALSE)
}

# -----------------------------------------------------------------------------
# hf_text_to_image: generate an image from a text prompt.
#   Returns the raw job response (contains a request/generation id).
# -----------------------------------------------------------------------------
hf_text_to_image <- function(client,
                             prompt,
                             aspect_ratio     = "9:16",
                             model            = "flux-pro/kontext/max/text-to-image",
                             safety_tolerance = 2,
                             seed             = NULL) {
  body <- list(
    prompt           = prompt,
    aspect_ratio     = aspect_ratio,
    safety_tolerance = safety_tolerance
  )
  if (!is.null(seed)) body$seed <- seed

  .hf_request(client, model) |>
    req_body_json(body) |>
    req_method("POST") |>
    .hf_perform()
}

# -----------------------------------------------------------------------------
# hf_image_to_video: animate a still image into a short clip.
#   input_images: character vector of publicly reachable image URLs.
# -----------------------------------------------------------------------------
hf_image_to_video <- function(client,
                              prompt,
                              input_images,
                              model    = "turbo",
                              motions  = NULL) {
  images <- lapply(input_images, function(u) {
    list(type = "image_url", image_url = u)
  })
  body <- list(
    model        = model,
    prompt       = prompt,
    input_images = images
  )
  if (!is.null(motions)) body$motions <- as.list(motions)

  .hf_request(client, "v1/image2video/dop") |>
    req_body_json(body) |>
    req_method("POST") |>
    .hf_perform()
}

# -----------------------------------------------------------------------------
# hf_status: check the status of a submitted generation by request id.
# -----------------------------------------------------------------------------
hf_status <- function(client, request_id) {
  .hf_request(client, paste0("requests/", request_id, "/status")) |>
    .hf_perform()
}

# -----------------------------------------------------------------------------
# hf_wait: poll until a generation finishes (or fails / times out).
#   Returns the final status payload. Terminal states: completed, failed, nsfw.
# -----------------------------------------------------------------------------
hf_wait <- function(client, request_id,
                    interval = 3, timeout = 300, verbose = TRUE) {
  terminal <- c("completed", "failed", "nsfw")
  deadline <- Sys.time() + timeout
  repeat {
    res    <- hf_status(client, request_id)
    status <- res$status %||% res$state %||% "unknown"
    if (verbose) message(sprintf("[%s] status: %s",
                                 format(Sys.time(), "%H:%M:%S"), status))
    if (status %in% terminal) return(res)
    if (Sys.time() > deadline) {
      stop(sprintf("Timed out after %d s waiting for request %s (last status: %s).",
                   timeout, request_id, status))
    }
    Sys.sleep(interval)
  }
}

# -----------------------------------------------------------------------------
# hf_extract_id: pull the request/generation id out of a submit response,
# tolerating the several field names the API has used.
# -----------------------------------------------------------------------------
hf_extract_id <- function(res) {
  res$request_id %||% res$generation_id %||% res$id %||%
    stop("Could not find a request id in the API response.")
}

# =============================================================================
# Example usage (not run automatically). Uncomment and supply credentials.
# =============================================================================
if (sys.nframe() == 0 && identical(Sys.getenv("HF_RUN_EXAMPLE"), "1")) {
  client <- hf_client()

  # 1) Text -> image
  img_job <- hf_text_to_image(
    client,
    prompt       = "A cinematic wide shot of the Dolomites at golden hour",
    aspect_ratio = "16:9"
  )
  img_id  <- hf_extract_id(img_job)
  img_res <- hf_wait(client, img_id)
  message("Image URL(s): ",
          paste(unlist(img_res$images), collapse = ", "))

  # 2) Image -> video
  vid_job <- hf_image_to_video(
    client,
    prompt       = "Slow cinematic push-in, drifting clouds",
    input_images = unlist(img_res$images)[1]
  )
  vid_id  <- hf_extract_id(vid_job)
  vid_res <- hf_wait(client, vid_id)
  message("Video URL: ", vid_res$video %||% "n/a")
}
