/*
 * OSS_HELP.HLP, the program's help file, as HTML. The text was decoded from the WinHelp file
 * (tools/re/hlp.py) and is transcribed as the team wrote it in January 1998, spelling and all;
 * only the layout is new. Links are <a data-topic="..."> and point at the keys below.
 */
(function (root) {
  'use strict';

  const TOPICS = {
    contents: {
      title: 'Contents',
      html: `
<h1>Contents</h1>
<p><a data-topic="general">General Information</a></p>
<p>Operating System Simulator:</p>
<ul>
  <li>Screens:
    <ul>
      <li><a data-topic="login">Log-in Screen</a></li>
      <li><a data-topic="main">Main Screen</a></li>
      <li><a data-topic="editor">Batch Editor Screen</a></li>
    </ul>
  </li>
  <li><a data-topic="commands">Commands</a></li>
  <li><a data-topic="misc">Miscellaneous</a></li>
</ul>`
    },

    general: {
      title: 'General Information',
      html: `
<h1>General Information</h1>
<p>Operating System Simulator (OSS) is a program that simulates an operating system. It was created for educational purposes therefore it does not have big capabilities. Also it is probable that there are several bugs left in the program as it was not possible for the programming team to test the program exhaustively.</p>
<p>Despite some drawbacks the program has some very interesting features. One of them is its ability to use three time sharing algorithms (FIFO, Round Robin and Shortest Job First). Also the commands in the program execute the most common tasks, such as access the printer, the screen and write and read form the memory and the hard drive. Finally the ability to execute batch files was added to the program.</p>
<p>The programmers feel that the programs behavior during the use of different time sharing algorithms is quite interesting and worth testing. For further information please refer to the manual.</p>`
    },

    login: {
      title: 'Log-In Screen',
      html: `
<h1>Log-In Screen</h1>
<p>This is the Log-In Screen of OSS. This screen appears at the start of the program. This screen contains an edit box on the left top of the window, a radio button panel next to the edit box and a Start the Simulation button in the right top. Beneath these controls is a detection screen and a progress bar.</p>
<p>The user must enter his name in the edit field, select one of the three time sharing algorithms and press the Start the Simulation button in order to enter the simulation.</p>
<p>When Start the Simulation button is pressed the program detects the chosen algorithm, the kind of processor used, the number of processors, the available and total physical and swap file memory and the allocation granularity of the system. All these are displayed in the above order at the detection screen, while the progress bar indicates the progress of the detection.</p>
<p>After the detection is complete the <a data-topic="main">main screen</a> of the program appears.</p>`
    },

    main: {
      title: 'Main Screen',
      html: `
<h1>Main Screen</h1>
<p>This is the Main Screen of OSS. It's window area is divided in two panels. The left panel contains the Screen field, the Command Line field and three buttons - Execute, Freeze and Reset.</p>
<p>The Screen field which occupies the bigger part of the panel simulates the screen of the computer. It is the place where several messages and results are displayed. The Command Line field is located beneath the Screen field and it is the area where the user types the <a data-topic="commands">commands</a> which are simulated by the program. In order for these commands to be executed the user must press the Execute button which lays beneath the Command Line. Next to the Execute button is the Freeze button. This button when pressed freezes the execution of any commands that are in progress at that time. In order for the execution of the commands to be resumed the user must press the same button again (which in the meantime will have changed into Continue). Finally next of the Freeze button to the right is the Reset button. This button is used to clear the memory, hard disk, screen and in general to set the values, used in the program. back to the ones that existed in the beginning.</p>
<p>The right panel contains 4 fields in the top, a smaller panel in the middle and two buttons in the bottom.</p>
<p>The four fields are: Active Tasks, Rem. Time (Remaining Time), Current Task and Time Quantum (milisecs). The Active Tasks field displays the number of commands that are being executed. The Current Task field displays the task (command) which is executed by the CPU each time quantum. The Rem. Time field displays the time which remains before the task, which is displayed in the Current Task field, is completed. Finally the Time Quantum field shows the real-time equivalent for each time quantum. This value can be changed by the user by editing a new value in the Time Quantum field, and the new value is used as soon as focus is moved of the Time Quantum field.</p>
<p>The panel beneath these fields displays information about the status of the printer, the memory accessed by the user and the contains of the hard disk. The information about these devices can be accessed by pressing the corresponding buttons which are located on the top of the panel (Memory, HDD ,Printer).</p>
<p>Finally there are two buttons on the bottom of the left panel: Exit to Windows and Help. Exit to Windows terminates OSS and Help accesses the help files.</p>
<p>-Note - All the actions committed by buttons are also included in the Menu Bar on the top of the Main Screen window.</p>`
    },

    editor: {
      title: 'Batch Editor Screen',
      html: `
<h1>Batch Editor Screen</h1>
<p>This is the Batch Editor screen. It contains an editing field and a list of buttons on it's right. In the editing field the uses can see and modify the contents of a batch file he has previously selected. The buttons located on the right are: Execute as One, Execute Separately, Open, Save as, Clear, Help , Back and Exit.</p>
<p>The functions of these buttons are:</p>
<ul>
  <li>Clicking on the Execute as One button the program saves the batch file, if not already saved, and passes the command for the execution of the batch file in the command line of the Main Screen.</li>
  <li>Clicking on the Execute Separately button the program saves the batch file, if not already saved, and passes the command for the execution of the commands included in the batch file as separate commands, to the Command Line of the Main Screen.</li>
  <li>Clicking on the Open button allows the user to open another batch file existing in his hard drive.</li>
  <li>Clicking on the Save As button saves the currently processed batch file.</li>
  <li>Clicking on the Clear button erases everything that is written on the currently processed batch file.</li>
  <li>Clicking on the Help button allows the user to access the help files of the program.</li>
  <li>Clicking on the Back button returns control to the <a data-topic="main">Main Screen</a> ignoring the changes made in the processed batch file.</li>
  <li>Finally clicking on the Exit button terminates the whole program and exits to Windows.</li>
</ul>
<p>These commands are also available in the Menu Bar on top of the window.</p>`
    },

    commands: {
      title: 'Commands',
      html: `
<h1>Commands</h1>
<p>Here are presented the commands that can be issued through the Command Line of the Main Screen as well as their syntax and function. The available commands are:</p>
<dl>
  <dt>1. <code>cmp / &lt;string1&gt; / &lt;string2&gt;</code></dt>
  <dd>It compares two strings and shows which one is higher and which one is lower. This command requires 1 time quantum for execution</dd>
  <dt>2. <code>prn &lt;string&gt;</code></dt>
  <dd>It sends the typed string to the printer. The result is displayed in the Printer Panel. This command requires 500 time quantum for execution.</dd>
  <dt>3. <code>scr &lt;string&gt;</code></dt>
  <dd>It displays the typed string in the Screen. This command requires 5 time quantum for execution.</dd>
  <dt>4. <code>ldm &lt;N&gt;</code></dt>
  <dd>It loads the contains of N memory position to the Screen. This command requires 1 time quantum for execution.</dd>
  <dt>5. <code>stm &lt;N&gt; &lt;string&gt;</code></dt>
  <dd>It stores the typed string to the N memory position. This command requires 1 time quantum for execution.</dd>
  <dt>6. <code>dlm &lt;N&gt;</code></dt>
  <dd>It deletes the contains of N memory position. This command requires 1 time quantum for execution.</dd>
  <dt>7. <code>ldd &lt;N&gt;</code></dt>
  <dd>It loads the contains of N hard drive position to the Screen. This command requires 100 time quantum for execution.</dd>
  <dt>8. <code>std &lt;N&gt; &lt;string&gt;</code></dt>
  <dd>It stores the typed string to the N hard drive position. This command requires 100 time quantum for execution.</dd>
  <dt>9. <code>dld &lt;N&gt;</code></dt>
  <dd>It deletes the contains of N hard drive position. This command requires 100 time quantum for execution.</dd>
  <dt>10. <code>end</code></dt>
  <dd>It terminates the current simulation and returns control to the <a data-topic="login">Log-In Screen</a>. This command requires 1 time quantum for execution.</dd>
  <dt>11. <code>dir</code></dt>
  <dd>It displays the batch files existing in the simulated hard drive. This command requires ? time quantum for execution.</dd>
  <dt>12. <code>dirreal</code></dt>
  <dd>This command is mostly an assisting command. It does not affect the simulation and it displays in the Screen the batch files that exist in the current directory of your real hard drive.</dd>
  <dt>13. <code>dirtasks</code></dt>
  <dd>This command is an assisting command, also. It does not affect the simulation and it displays in the Screen the tasks that are currently under execution. In Screen the information which appear are in the following order: &lt;command&gt;&lt;time remaining&gt;&lt;parameter 1&gt;&lt;parameter 2&gt;&lt;number of task&gt;</dd>
  <dt>14. <code>edit &lt;name&gt;.bch</code></dt>
  <dd>This command opens the <a data-topic="editor">Batch Editor Screen</a> where the user can edit the specified batch file. This command does not interfere with the execution of the active tasks which continue when the editor is open.</dd>
  <dt>15. <code>terminate &lt;N&gt;</code></dt>
  <dd>This command allows the user to terminate a task that is currently executed. The number N is the number of the task as it is presented by the OSS. If this command is successful then a message about the terminated task should appear in the Screen. This command does not affect the execution of the other tasks.</dd>
  <dt>16. <code>&lt;name&gt;.bch</code></dt>
  <dd>This command executes a batch file. If a batch file is executed this way the program considers the file equivalent to a single command. Note however that you are not allowed to call another batch file from inside the executed file. This command requires 5 time quantum plus the time quantum of each command in it.</dd>
  <dt>17. <code>&lt;name&gt;.bch /s</code></dt>
  <dd>By using the /s parameter after the name of a batch file during execution the program executes each command in the batch file separately, that is as if each command was issued through the command line. This command requires 5 time quantum plus the time quantum of each command in it.</dd>
</dl>
<p>This is an example of an issued command: <code>std 32 computer</code></p>
<p>This command stores the string 'computer' in the 32nd position of the simulated hard drive.</p>
<p>-Note - In order for a command to be executed the Execute button must be pressed. Also the numbers used to determine a position in the memory or the hard drive must be between 1 and 100 as these are the set capacities of both memory and hard drive.</p>`
    },

    misc: {
      title: 'Miscellaneous',
      html: `
<h1>Miscellaneous</h1>
<p>This program (OSS) was created for the needs of the 3rd semester class "Operating Systems I". The following persons participated in its' creation: Anagnostou Achilles, Agapiou Stauros, Karakoidas Basilis, Kotoula Vivi, Maurogiorgos George and Polychronopoulos Elias.</p>
<p>This help file is included in version 1.2 of the program. Although there are many modifications and improvements made since the first version it is possible that there are bugs left in this program. For any known bugs or conflicts please refer to the manual. If any new ones are found we would be glad to correct them.</p>
<p>Thank you for testing this program.</p>`
    }
  };

  // The order WinHelp's << and >> buttons walk the topics in (the file's own order).
  const SEQUENCE = ['contents', 'general', 'login', 'main', 'editor', 'commands', 'misc'];

  root.OSSHelp = { TOPICS, SEQUENCE };
})(typeof self !== 'undefined' ? self : this);
