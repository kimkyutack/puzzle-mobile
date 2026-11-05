#!/bin/sh
set -eu
# Simulator-only ad hoc identity: real device/App Store builds require the developer's provisioning profile.
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- -derivedDataPath output/native/ios
