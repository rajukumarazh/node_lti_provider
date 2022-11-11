//Require Standard Modules
const express = require("express");
const morgan = require("morgan");
const axios = require("axios")
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
const cors=require("cors");
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

const path = require('path');

//Required Library methods
const Database = require('../node_modules/lti-node-library/Provider/mongoDB/Database');
const { platformSchema, registerPlatform } = require('../node_modules/lti-node-library/Provider/register_platform');
const { create_oidc_response, create_unique_string } = require("../node_modules/lti-node-library/Provider/oidc");
const { launchTool } = require("../node_modules/lti-node-library/Provider/launch_validation");
const { tokenMaker } = require("../node_modules/lti-node-library/Provider/token_generator");
const { prep_send_score, send_score } = require("../node_modules/lti-node-library/Provider/student_score");

//Required Tool methods
const { grade_project } = require("../tool/grading_tool");

/*
* Setup basic Express server
*/
const app = express();
app.use(cors())
app.use(morgan("dev"));

app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

/*
* Setup for Tool
*/
app.use('/favicon.ico', express.static('./favicon.ico'));

app.use( (req,res,next) => {
  res.locals.formData = null;
  next();
});

app.set("views", "./views");
app.set("view engine", "ejs");

/** Setup MongoDB to store Platform data
 * mongodb+srv://deepak:56781234@cluster0.xcexpij.mongodb.net/lti?retryWrites=true&w=majority
*/
mongoose.connect("mongodb://localhost:27017/lti", {
  useNewUrlParser: true, 

},
  (err) => {
    if(err) {
      return console.log(err);
    }
});
mongoose.Promise = Promise;

registerPlatform(
  'http://elearningstack.com/ilearn24x7',
  'moodle',
  'gB4n7MSwyDKMmD1',
  'http://elearningstack.com/ilearn24x7/mod/lti/auth.php',
  'http://elearningstack.com/ilearn24x7/mod/lti/token.php',
  'https://localtunnelname.loca.lt/project/submit',
  { method: 'JWK_SET', key: 'http://elearningstack.com/ilearn24x7/mod/lti/certs.php' }
);

app.get('/publickey/:name', async (req, res) => {
  let publicKey = await Database.GetKey(
    'platforms',
    platformSchema,
    { consumerName: req.params.name }
  );
  res.json({key: publicKey});
});

/*
* Setup Session to store data
*/
app.use(session({
  name: 'lti_v1p3_library',
  secret: 'iualcoelknasfnk',
  saveUninitialized: true,
  resave: true,
  secure: true,
  ephemeral: true,
  httpOnly: true,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

/*
* Routes below are for OAuth, OIDC, and Token usage
*/
app.get('/oidc', (req, res) => {
  //TOOL:  OpenID Connect validation flow
  create_oidc_response(req, res);
}); 

app.post('/oidc', (req, res) => {
  //TOOL:  OpenID Connect validation flow
  console.log("this is test");
  create_oidc_response(req, res);
});

app.post("/oauth2/token", (req, res) => {
  //LIBRARY:  Route not currently being used
  tokenMaker(req, res);
});

app.post('/auth_code', (req, res) => {
  if (!req.body.error) {
    send_score(req, req.session.grade, 1);
  } else {
    res.status(401).send('Access denied: ' + req.params.error);
  }
});

/*
* Routes below are for running the Tool itself
*/
app.post("/project/submit", (req, res) => {
  //TOOL:  Validate and launch Tool 
  req.session = oldreq.session;
  launchTool(req, res, '/project/submit');
});

app.get("/deeplink", async  (req, res) => {
  //TOOL:  Validate and launch Tool 
  const jwt_string = req.query.jwt_string; 
  let basic_decoded = jwt.decode(jwt_string, {complete: true});
  jwtdata = basic_decoded['payload'];
  var contenturl = jwtdata['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings']['deep_link_return_url'];     
  var consumerkey = jwtdata['https://purl.imsglobal.org/spec/lti/claim/tool_platform']['guid'];
  
   async function getData(){ 

    let data =await axios.get("https://suiterc.icareus.com/api/publishing/getAssets?version=03&organizationId=1909009&groupItemId=3122701&languageId=en_US&order=desc&limit=10&token=05634d54044ed9e4a9ebc8fbcb02672263f5ec363d").then((res)=>res)
    // res.send(JSON.stringify(data))
    let rethtml = '<ul style="width:100%">';
    data.data.assets.map((video)=>{
      
    var  oldjwt = basic_decoded['payload'];
     content = [{
       
        type : 'ltiResourceLink',
        iframe : 
        {
          src:video.embedUrl
        },
        title:  video.name,
         url: video.embedUrl
      }]
       
      oldjwt['iss'] = 'gB4n7MSwyDKMmD1';
      oldjwt['lti_message_type'] =  'ContentItemSelection';
      oldjwt['lti_version'] =  '1.3.0';
     
      oldjwt['content_items'] = content;        
      
      const accessTokenSecret = 'secret';
      const accessToken  = jwt.sign(oldjwt, accessTokenSecret);
      newlink = contenturl +'&JWT='+accessToken;
      
      rethtml =  rethtml+'<li style="list-style:none;width:31%;margin:0 1%; float:left"><a href="'+newlink+'"><img width="100%" src="'+video.thumbnailLarge+'" />'+video.name+'</a></li>';
      
    })
 
    rethtml =  rethtml+'</ul>';
    
    res.send(rethtml);
    
  }
  getData();
  
  // try {
  //   const resource = req.body

  //   const items = {
  //     type: 'ltiResourceLink',
  //     title: 'Ltijs Demo',
  //     custom: {
  //       name: "Deepaksharma",
  //       value: "testdeep"
  //     }
  //   }

  //   const form = await lti.DeepLinking.createDeepLinkingForm(res.locals.token, items, { message: 'Successfully Registered' })
  //   if (form) return res.send(form)
  //   return res.sendStatus(500)
  // } catch (err) {
  //   console.log(err.message)
  //   return res.status(500).send(err.message)
  // }
  
});

app.get("/project/submit", (req, res) => {
  //TOOL:  Display the Project Submission page
  res.render("submit", {
    payload: req.session.payload, 
    formData: req.body.formData
  });
});

app.post(`/project/grading`, (req, res) => {
  //TOOL:  Grade the project and send the score if no errors; re-render Grading page.
  grade_project(req)
  .then(grading => {
    if (!grading.error) {
      req.session.grade = grading.grade;
      // const redir = prep_send_score(req);
      // res.redirect(307, redir);
    }
    res.render("submit", {
      payload: req.session.payload, 
      formData: grading
    });
  });
});

app.post('/project/return', (req, res) => {
  //TOOL:  When user is done with Tool, return to Platform
  res.redirect(req.session.decoded_launch["https://purl.imsglobal.org/spec/lti/claim/launch_presentation"].return_url);
  req.session.destroy();   //TODO:  Make sure sessions are being destroyed in MongoDB
});

/*
* The Routes below are for DEMO purposes
*/
app.get("/", (req, res) => {
  //DEMO:  Shows OIDC Example data flow page
  res.render("index");
});

app.post('/demo/oidc', (req, res) => {
  //DEMO:  Sends an OIDC Login Response for demo purposes
  req.body = { 
    iss: 'http://elearningstack.com/ilearn24x7',
    target_link_uri: 'https://node-lti-v1p3.herokuapp.com/',
    login_hint: '9',
    lti_message_hint: '377' 
  };
  req.session.platform_DBinfo = {'consumerToolClientID': 'gB4n7MSwyDKMmD1'};
  async function getData(){ 
    let data =await axios.get("https://suiterc.icareus.com/api/publishing/getAssets?version=03&organizationId=1909009&groupItemId=3122701&languageId=en_US&order=desc&limit=10&token=05634d54044ed9e4a9ebc8fbcb02672263f5ec363d").then((res)=>res)
    // res.send(JSON.stringify(data))
    let rethtml = '<ul style="width:100%">';
    data.data.assets.map((video)=>{
      rethtml =  rethtml+'<li style="list-style:none;width:31%;margin:0 1%; float:left"><img width="100%" src="'+video.thumbnailLarge+'" /></li>';
      console.log("data",video);
    })
    rethtml =  rethtml+'</ul>';
    res.send(rethtml);
    
  }
  getData();

  
  
//   res.send({
//     scope: 'openid',
//     response_type: 'id_token',
//     client_id: req.session.platform_DBinfo.consumerToolClientID,
//     redirect_uri: 'https://localtunnelname.loca.lt/demo/project/submit',
//     login_hint: req.body.login_hint,
//     state: create_unique_string(30, true),
//     response_mode: 'form_post',
//     nonce: create_unique_string(25, false),
//     prompt: 'none'
//   });
 })

app.get('/demo/oidc', async (req, res) => {
  //DEMO:  Sends an OIDC Login Response for demo purposes
  req.body = { 
    iss: 'http://elearningstack.com/ilearn24x7',
    target_link_uri: 'https://node-lti-v1p3.herokuapp.com/',
    login_hint: '9',
    lti_message_hint: '377' 
  };
  req.session.platform_DBinfo = {'consumerToolClientID': 'gB4n7MSwyDKMmD1'};
  let data=fetch("https://suiterc.icareus.com/api/publishing/getAssets?version=03&organizationId=1909009&groupItemId=3122701&languageId=en_US&order=desc&limit=10&token=05634d54044ed9e4a9ebc8fbcb02672263f5ec363d")
  .then((response) => {
    // Do something with response
    return response
  })
  .catch(function (err) {
    console.log("Unable to fetch -", err);
  });
  console.log('esponse',data)
//   let data= await axios.get("https://suiterc.icareus.com/api/publishing/getAssets?version=03&organizationId=1909009&groupItemId=3122701&languageId=en_US&order=desc&limit=10&token=05634d54044ed9e4a9ebc8fbcb02672263f5ec363d")
//   .then(data => (data))
res.send(data)
// console.log("data",data)
  // res.send({
  //   scope: 'openid',
  //   response_type: 'id_token',
  //   client_id: req.session.platform_DBinfo.consumerToolClientID,
  //   redirect_uri: 'https://localtunnelname.loca.lt/demo/project/submit',
  //   login_hint: req.body.login_hint,
  //   state: create_unique_string(30, true),
  //   response_mode: 'form_post',
  //   nonce: create_unique_string(25, false),
  //   prompt: 'none'
  // });
})

app.post('/demo/project/submit', (req, res) => {
  //DEMO:  Launches the Grading Tool for demo purposes
  let request_object = { nonce: 'g2f2cdPpYqPK7AwHcyXhjf5VL',
  iat: 1564506231,
  exp: 1564506291,
  iss: 'http://elearningstack.com/ilearn24x7',
  aud: 'uuYLGWBmhhuZvBf',
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': '2',
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': 'https://node-lti-v1p3.herokuapp.com//',
  sub: '9',
  'https://purl.imsglobal.org/spec/lti/claim/roles':
  [ 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner' ],
  'https://purl.imsglobal.org/spec/lti/claim/context':
     { id: '47',
       label: 'AGILE200',
       title: 'NOTE: DEMO ONLY, THIS TOOL IS NOT FUNCTIONAL',
       type: [ 'CourseSection' ] },
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': { title: 'Test LTI for Team Pied Piper', id: '4' },
    given_name: 'John',
    family_name: 'Smith',
    name: 'John Smith',
    'https://purl.imsglobal.org/spec/lti/claim/ext':
     { user_username: 'john.smith@gmail.com', lms: 'moodle-2' },
    email: 'john.smith@gmail.com',
    'https://purl.imsglobal.org/spec/lti/claim/launch_presentation':
     { locale: 'en',
       document_target: 'window',
       return_url:
        'https://www.sandiegocode.school/mod/lti/return.php?course=47&launch_container=4&instanceid=4&sesskey=xcsU4krTwV' },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform':
     { family_code: 'moodle',
       version: '2019052000.01',
       guid: 'demo.moodle.net',
       name: 'Moodle Demo',
       description: 'Moodle Demo Sandbox' },
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint':
     { scope:
        [ 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
          'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
          'https://purl.imsglobal.org/spec/lti-ags/scope/score' ],
       lineitems:
        'https://www.sandiegocode.school/mod/lti/services.php/47/lineitems?type_id=2',
       lineitem:
        'https://www.sandiegocode.school/mod/lti/services.php/47/lineitems/109/lineitem?type_id=2' },
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice':
     { context_memberships_url:
        'https://www.sandiegocode.school/mod/lti/services.php/CourseSection/47/bindings/2/memberships',
       service_versions: [ '1.0', '2.0' ] }
  };  
  res.render("submit", {
    payload: request_object, 
    formData: null
  });
})

//deep link
// Deep linking route
app.post('/deeplink', async (req, res) => {
  try {
    // const resource = req.body

    const items = {
      type: 'https://suiterc.icareus.com/web/test-account/player/embed/vod?assetId=1910214',
      title: 'Ltijs Demo',
      // custom: {
      //   name: resource.name,
      //   value: resource.value
      // }
    }

    const form = await lti.DeepLinking.createDeepLinkingForm(res.locals.token, items, { message: 'Successfully Registered' })
    if (form) return res.send(form)
    return res.sendStatus(500)
  } catch (err) {
    console.log(err.message)
    return res.status(500).send(err.message)
  }
})
app.get('/demo/project/submit', (req, res) => {
  //DEMO:  Launches the Grading Tool for demo purposes
  let request_object = { nonce: 'g2f2cdPpYqPK7AwHcyXhjf5VL',
  iat: 1564506231,
  exp: 1564506291,
  iss: 'http://elearningstack.com/ilearn24x7',
  aud: 'uuYLGWBmhhuZvBf',
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': '2',
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': 'https://node-lti-v1p3.herokuapp.com//',
  sub: '9',
  'https://purl.imsglobal.org/spec/lti/claim/roles':
  [ 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner' ],
  'https://purl.imsglobal.org/spec/lti/claim/context':
     { id: '47',
       label: 'AGILE200',
       title: 'NOTE: DEMO ONLY, THIS TOOL IS NOT FUNCTIONAL',
       type: [ 'CourseSection' ] },
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': { title: 'Test LTI for Team Pied Piper', id: '4' },
    given_name: 'John',
    family_name: 'Smith',
    name: 'John Smith',
    'https://purl.imsglobal.org/spec/lti/claim/ext':
     { user_username: 'john.smith@gmail.com', lms: 'moodle-2' },
    email: 'john.smith@gmail.com',
    'https://purl.imsglobal.org/spec/lti/claim/launch_presentation':
     { locale: 'en',
       document_target: 'window',
       return_url:
        'https://www.sandiegocode.school/mod/lti/return.php?course=47&launch_container=4&instanceid=4&sesskey=xcsU4krTwV' },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform':
     { family_code: 'moodle',
       version: '2019052000.01',
       guid: 'demo.moodle.net',
       name: 'Moodle Demo',
       description: 'Moodle Demo Sandbox' },
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint':
     { scope:
        [ 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
          'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
          'https://purl.imsglobal.org/spec/lti-ags/scope/score' ],
       lineitems:
        'https://www.sandiegocode.school/mod/lti/services.php/47/lineitems?type_id=2',
       lineitem:
        'https://www.sandiegocode.school/mod/lti/services.php/47/lineitems/109/lineitem?type_id=2' },
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice':
     { context_memberships_url:
        'https://www.sandiegocode.school/mod/lti/services.php/CourseSection/47/bindings/2/memberships',
       service_versions: [ '1.0', '2.0' ] }
  };  
  res.render("submit", {
    payload: request_object, 
    formData: null
  });
})

module.exports = app;
