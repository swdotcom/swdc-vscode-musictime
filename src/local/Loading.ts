export async function getLoadingHtml() {
  return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit=no">
          <title>Music Time</title>
          <style>
            * {
              box-sizing: border-box;
            }

            *, ::before, ::after {
                --tw-shadow: 0 0 #0000;
            }

            *, ::before, ::after {
                --tw-border-opacity: 1;
                border-color: rgba(228, 228, 231, var(--tw-border-opacity));
            }
            *, ::before, ::after {
                box-sizing: border-box;
                border-width: 0;
                border-style: solid;
                border-color: currentColor;
            }

            body {
              font-weight: 400;
              background-color: transparent;
              color: #9c9c9c;
              text-align: center;
            }

            .wrapper {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding-top: 8px;
              padding-bottom: 8px;
            }
          </style>
      </head>
      <body>
        <div class="wrapper">
            Loading playlists...
        </div>
      </body>
      </html>`;
}
