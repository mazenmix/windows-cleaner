# MX Cleaner

A lightweight Windows batch utility that safely removes disposable temporary files and browser cache files without touching personal data.

## Features

* Runs automatically with no menu or key press.
* Uses a clean command-line interface.
* Requests administrator permission when required.
* Automatically closes after the cleanup is complete.
* Skips locked or currently used files instead of forcing their removal.
* Includes safety checks that protect critical Windows and user folders.

## What It Cleans

The cleaner removes disposable files from:

* User temporary folders
* Windows temporary folders
* Windows internet cache
* Google Chrome cache
* Microsoft Edge cache
* Brave Browser cache
* Mozilla Firefox cache
* Browser GPU and code caches
* Browser crash reports
* Windows Error Reporting cache

## What It Does Not Delete

MX Cleaner does **not** delete or modify:

* Personal files or folders
* Desktop files
* Documents
* Pictures
* Videos
* Music
* Downloads
* Browser passwords
* Browser bookmarks
* Browser history
* Browser cookies
* Browser extensions
* Browser sessions or saved logins
* Windows Prefetch
* Windows restore points
* Windows Update files
* The Recycle Bin
* Installed applications
* Windows services
* Registry settings
* Windows or Microsoft Office activation

## How It Works

1. Open the cleaner.
2. Approve the Windows administrator prompt when requested.
3. The cleanup begins automatically.
4. Temporary and cache files are removed.
5. Locked files are skipped safely.
6. The cleaner closes automatically when finished.

## Safety Design

Before deleting anything, the cleaner checks the full target path and blocks deletion when the target points to a critical Windows or user location.

Only disposable contents inside approved temporary and cache locations are removed. The main folders remain in place.

## Compatibility

* Windows 10
* Windows 11
* Administrator permission may be required.

## Notes

* Close web browsers before running the cleaner for the most complete cache cleanup.
* Files currently used by Windows or another application are skipped automatically.
* This tool focuses only on temporary files and cache cleanup.
* It does not overclock hardware, edit the registry, disable services, or change Windows security settings.
  
