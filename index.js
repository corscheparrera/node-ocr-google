'use strict'

const express = require('express')
const fs = require('fs')
const util = require('util')
const https = require('https')
const request = require('request')
const natural = require('natural')
/*  A MIME type consists of 2 parts: 
1) it defines what web content is at a high level (image, video, application, etc.), 
2) it defines what web content is a more detailed level (png, avi, javascript, etc.)
This 2 part definition is needed so clients web browsers can translate content that servers give them into terms users like us can experience.
*/
const mime = require('mime')

/* Multer adds a body object and a file or files object to the request object. 
The body object contains the values of the text fields of the form, 
 the file or files object contains the files uploaded via the form. */
const multer = require('multer')

const upload = multer({ dest: 'uploads/' })

const app = express()

// Simple upload form
let form =
  '<!DOCTYPE HTML><html><body>' +
  "<form method='post' action='/upload' enctype='multipart/form-data'>" +
  "<input type='file' name='image'/>" +
  "<input type='submit' /></form>" +
  '</body></html>'

app.get('/', function(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/html',
  })
  res.end(form)
})

// Get the uploaded image
// Image is uploaded to req.file.path

app.post('/upload', upload.single('image'), (req, res, next) => {
  const image = fs.readFileSync(req.file.path).toString('base64')
  const reqOptions = {
    uri: 'https://vision.googleapis.com/v1/images:annotate?key={PUT API KEY HERE}',
    headers: { 'Content-Type': 'application/json' },
    json: {
      requests: [
        {
          image: {
            content: image,
          },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        },
      ],
    },
  }
  // Send the image to the Cloud Vision
  request.post(reqOptions, function(err, response, body) {
    if (err) {
      res.end('Cloud Vision Error')
    } else {
      const responseText = response.body.responses[0].fullTextAnnotation.text.split('\n')
      console.log(responseText)

      // Index # of "Description de l'infraction"
      const indexDescription = responseText.findIndex(x => x == "Description de l'infraction")

      // Index # of "Art." Title
      const indexArticle = responseText.findIndex(x => x.includes('Art: '))

      // Description de l'infraction (titre)
      const descriptionTitre = responseText[indexDescription].toString()

      // Description de l'infraction (paragraphe)
      const descriptionPar = responseText.slice(indexDescription + 1, indexArticle).toString()

      // Article enfreint
      const articleEnfreint = responseText[indexArticle]

      console.log(descriptionTitre + ': ' + descriptionPar + ' ' + articleEnfreint)
      res.writeHead(200, {
        'Content-Type': 'text/html',
      })
      res.write('<!DOCTYPE HTML><meta charset="UTF-8"><html><body>')

      res.write(
        "<h2>Description de l'infraction:</h2><br><h3>" +
          articleEnfreint +
          ' ' +
          descriptionPar +
          '</h3><br>'
      )
      // Base64 the image so we can display it on the page
      res.write('<img width=500 src="' + base64Image(req.file.path) + '"><br>')

      // Write out the JSON output of the Vision API
      res.write(JSON.stringify(responseText))

      res.end('</body></html>')

      // Delete uploaded file
      fs.unlinkSync(req.file.path)
    }
  })
})

app.listen(8080)
console.log('Server Started')

// Turn image into Base64 so we can display it easily
function base64Image(src) {
  let data = fs.readFileSync(src).toString('base64')
  return util.format('data:%s;base64,%s', mime.lookup(src), data)
}
