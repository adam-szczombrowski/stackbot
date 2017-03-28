"use strict";

const ts = require('./tinyspeck.js');

var slack = ts.instance({ });
var connected=false;
var request = require('request');

var stackexchange = require('stackexchange');

var options = { version: 2.2 };
var context = new stackexchange(options);
var converter = require('html-to-markdown');

slack.on('/stackbot', payload => {
  console.log("Received /stack slash command from user " + payload.user_id);
  let response_url = payload.response_url;
  let command_text = payload.text;
  
  if (command_text=='help')
    {
      let message = Object.assign({ text: '', attachments: [helpAttachment()] });
      respondToSlack(response_url, message);
    }
  else
    {
      var searchVars = getPageSizeAndSearchText(command_text);
      let pagesize = searchVars[0];
      let search_text = searchVars[1];
      let response_type = searchVars[2];
  
      let filter = setupFilter(pagesize, search_text);

      context.search.search(filter, function(err, results){
        if (err) throw err;

        let message = formatResults(results, search_text, response_type);
        respondToSlack(response_url, message);
      });
    }
});

function getPageSizeAndSearchText(command_text) {
  var response_type = 'ephemeral';
  var pagesize = 3;
  var search_text = command_text

  if (command_text.match(/answers:\d+/))
  {
    var answers_option = command_text.match(/answers:\d+/)[0];
    var pagesize = answers_option.match(/\d+/);
    var search_text = command_text.replace(/answers:\d+/, '');
  }
  
  if(search_text.match(/publishToChannel/))
  {
    var search_text = search_text.replace(/publishToChannel/, '');
    var response_type = 'in_channel';
  }
  
  console.log('pagesize: ', pagesize);
  console.log('search_text: ', search_text);
  console.log('response_type: ', response_type);
  return [pagesize, search_text, response_type];
}

function setupFilter(pagesize, search_text) {
  return {
    pagesize: pagesize,
    sort: 'votes',
    order: 'desc',
    intitle: search_text,
    filter: 'withbody',
    min: 1
  };
}

function helpAttachment() {
  return {
    "fallback": "This is a help section for stackbot",
    "color": 'good',
    "title": 'Stackbot - basic usage',
    "text": 'Type /stackbot "[my question on stack overflow]"',
    "fields": [
        {
            "title": "Stackbot help",
            "value": "To get help type /stackbot help",
            "short": false
        },
        {
            "title": "Number of answers",
            "value": "To specify number of answers add answers:x where x is the number",
            "short": false
        },
        {
          "title": "Publish to channel",
          "value": "To publish to channel add publishToChannel option",
          "short": false
        }
    ],
  }
}

function escapeHTML(string) {
    return string.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function extractQuestionInfoIntoAttachements(element) {
  if (element.is_answered == true){
    var color = 'good'
  }else{
    var color = 'danger'
  }

  return {
    "fallback": "Required plain-text summary of the attachment.",
    "color": color,
    "author_icon": "http://flickr.com/icons/bobby.jpg",
    "title": element.title,
    "title_link": element.link,
    "text": converter.convert(format(element.body)),
    "mrkdwn_in": ["text"],
    "fields": [
        {
            "title": "Number of votes",
            "value": element.score,
            "short": true
        },
        {
            "title": "Number of answers",
            "value": element.answer_count,
            "short": true
        }
    ],
    "ts": element.creation_date
  }  
}

function format(string) {
  var code_replaced = string.replace(/<code>/g, '```\n').replace(/<\/code>/g, '\n```');
  var pre_replaced = code_replaced.replace(/<pre>/g, '`').replace(/<\/pre>/g, '`');
  return pre_replaced;
}

function formatResults(results, search_text, response_type) {
  if (results.items.length == 0){
    var formatted_response = 'There are no questions on this topic on StackOverflow';
  }else{
    var attachments = results.items.map(extractQuestionInfoIntoAttachements);
    var formatted_response = '*' + search_text + '*';
  }
  
  return Object.assign({ response_type: response_type, text: formatted_response, attachments: attachments })
};

function respondToSlack(response_url, message){
  slack.send(response_url, message).then(res => { // on success
    console.log("Response sent to /stack slash command");
  }, reason => { // on failure
    console.log("An error occurred when responding to /stack slash command: " + reason);
  });
};
    
// incoming http requests
slack.listen('3000');
