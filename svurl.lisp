; -*- mode:lisp; -*-

;;; svurl.lisp
;;; ==========
;; 2020-10-29T10:00

;;; DESCRIPTION
;;; ===========
;; Manipulate lists between saved, used, and utility

;;; DEPENDENCIES
;;; ============
;; quri: https://github.com/fukamachi/quri
;; Yet another URI library for Common Lisp
;; ---------------------------------------
;; 7 URI components -- scheme, userinfo, host name, port, path, query
;; and fragment.

;;; CODE
;;; //////////////////////////////////////////////////////////////////

(ql:quickload :quri)

(defun get-lines (filespec) ; => list of lines in FILESPEC
  "Place the lines  found in FILESPEC (a filestring) into  a list, one
line per  element, and return  the list. The  list will be  in reverse
order until saved."
  (with-open-file (stream filespec :if-does-not-exist :create)
    ;; not sure that this is the correct loop for this objective,
    ;; but it works.
    (loop with lines = ()
	  for line = (read-line stream nil)
	  until (eq line nil)
	  do (setq lines (adjoin line lines :test #'string=))
	  finally (return lines))))

(defun find-line-maybe (line lines) ; => LINE | NIL
  "Return a LINE from LINES if it exists, or NIL if not."
  (find line lines :test #'string=))

(defun get-line-pos (pos lines) ; => LINE | NIL
  "Return a line  found at position POS  from LINES, or NIL  if POS is
out of bounds."
  (and
   (>= pos 0)
   (< pos (length lines))
   (elt lines pos)))

(defun add-line-maybe (line lines) ; => LINES | NILL
  "Add a  LINE to the front  of a list of  LINES if it is  not already
there. Return  the new LINES or  NIL if the LINE  already existed. The
line will be at end of the list when saved."
  (unless (find-line-maybe line lines)
    (setq lines (cons line lines))))

(defun line-as-uri (line) ; => URI | NIL
  "Given a  LINE that is a  URI, parse it. Return  NIL if it is  not a
parseable URI."
  (let ((uri (quri:uri line)))
    (when (quri:uri-scheme uri)
      uri)))

(defun uri-as-line (uri) ; => LINE
  "Given a URI, return a line as a string without fragment or query."
  (quri:render-uri
   (quri:make-uri :scheme (quri:uri-scheme uri)
		  :host   (quri:uri-host uri)
		  :path   (quri:uri-path uri))))

(defun add-uri-maybe (line lines) ; => LINES | NIL
  "Add a uri from LINE to LINES if it is a valid uri; otherwise return
NIL."
  (let ((parsed-uri (line-as-uri line)))
    (when parsed-uri
      ;; remove the fragment and query, if any
      (add-line-maybe (uri-as-line parsed-uri) lines))))

(defun remove-line (line lines) ; => LINES
  "Remove a LINE from a list of  LINES if it exists and return the new
list of lines; otherwise just return the same list of LINES."
  (remove line lines :test #'string=))

(defun remove-line-pos (pos lines) ; => LINES
  "Remove the  line found at position  POS and return the  new list of
LINES. Return the origin LINES if POS is out of bounds."
  (if
   (and
    (>= pos 0)
    (<  pos (length lines)))
   (append
    (subseq lines 0 pos)
    (subseq lines (1+ pos)))
   lines))

(defun move-line-maybe (line &key from to) ; => (LINES LINES) | NILL
  "Move a  line by string  value from :FROM to  :TO. If LINE  does not
exist in FROM,  return NIL. If the  LINE exists in TO,  remove it from
FROM and return both lists."

  (when (find-line-maybe line from) ; if LINE does not exist in FROM, return NIL
    (let ((newfrom (remove-line-maybe line from))
	  (newto (add-line-maybe line to)))
      (unless newto (setq newto to)) ; if LINE exists in TO, return original TO
      (list newfrom newto)))) ; return a list of lists; TODO return multiple values

(defun move-line-pos (pos &key from to) ; => (LINES LINES) | NIL
  "Move a line at POS (numerical value) from FROM to TO using MOVE-LINE-MAYBE.
If POS is out of bounds, return NIL."
  (let ((line (get-line-pos pos from)))
    (when line (move-line-maybe line :from from :to to))))

(defun save-lines (lines filespec) ; => NIL
  "Save the LINES to FILESPEC."
  (with-open-file
      (*standard-output* filespec
			 :direction :output
			 :if-exists :append
			 :if-does-not-exist :create)
    (loop for line in (reverse lines) do (princ line)(terpri))))

(defun list-args () (print ccl:*unprocessed-command-line-arguments*))

(list-args)

;;; END CODE
