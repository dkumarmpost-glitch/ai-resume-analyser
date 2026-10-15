# TODO

- [ ] Backend: Add protected DELETE routes in `server/routes/resume.js`
  - [ ] `DELETE /api/resume/history/:id`
  - [ ] `DELETE /api/resume/history`
- [ ] Backend: Implement controller functions in `server/controllers/resumeController.js`
  - [ ] `deleteOneHistory` with auth ownership check + 403
  - [ ] `clearAllHistory` deleting all by userId + deletedCount
  - [ ] Export + wire controllers to routes
- [ ] Frontend: Update History page in `resume-analyser/src/App.js`
  - [ ] Add trash icon button per history entry (confirm + DELETE :id)
  - [ ] Add “Clear All History” button near History heading (confirm + DELETE history)
  - [ ] Remove deleted entry / clear list without refresh
- [ ] Verify manually
  - [ ] Delete single entry works and only affects that user’s entry
  - [ ] Clear all history works and shows “No resumes analysed yet”
  - [ ] UI updates instantly after success
