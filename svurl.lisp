; -*- mode:lisp; -*-

;;; svurl.lisp
;;; ==========
;; 2020-10-30T08:20

;;; DESCRIPTION
;;; ===========
;; Manipulate lists between saved, used, and utility

;;; DEPENDENCIES
;;; ============

;; quicklisp: https://www.quicklisp.org/beta/
;; A library manager for Common Lisp
;; ------------------------------------------

;; quri: https://github.com/fukamachi/quri
;; Yet another URI library for Common Lisp
;; ---------------------------------------
;; 7 URI components -- scheme, userinfo, host name, port, path, query
;; and fragment.

;; CCL
;; ---
;; M-x slime is set up to start the CCL REPL in EMACS.
;; M-x slime-eval-buffer will load the CCL REPL with the forms in this
;; program.
;; The following will run this program using CCL from the command line
;; with arguments args...
;; $ ccl --quiet --batch --load svurl.lisp -- [args...]
;; $ ccl -Qb -l svurl.lisp -- [args...]

;;; DATA SPECIFICATION
;;; ==================
;; FILESPEC: string representing a file path
;; LINE:     string representing a line of text in a file
;; LINES:    list of LINEs
;; URI:      parsed LINE containing a valid uri string; fragments and
;;           query params will be removed when returned as a LINE
;; POS:      integer greater then or equal to 0 representing a
;;           position in a LINES list.

;;; CODE
;;; //////////////////////////////////////////////////////////////////

;;; LOAD DEPENDENCIES

(ql:quickload :quri :silent t)

;;; LIBRARY PROCEDURES

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

(defun uri-from-line (line) ; => URI | NIL
  "Given a  LINE that is a  URI, parse it. Return  NIL if it is  not a
parseable URI."
  (let ((uri (quri:uri line)))
    (when (quri:uri-scheme uri)
      uri)))

(defun line-from-uri (uri &optional no-path) ; => LINE
  "Given a URI,  return a line as a string  without fragment or query.
If optional arg no-path is T, do not include the :path portion."
  (quri:render-uri
   (quri:make-uri :scheme (quri:uri-scheme uri)
		  :host   (quri:uri-host uri)
		  :path   (unless no-path (quri:uri-path uri)))))

(defun add-uri-maybe (line lines &optional no-path) ; => LINES | NIL
  "Add a LINE with fragment and  params stripped (and also the path if
optional NO-PATH  is T)  to LINES  if LINE is  a valid  uri; otherwise
return NIL."
  (let ((parsed-uri (uri-from-line line)))
    (when parsed-uri
      ;; remove the fragment and query, if any
      (add-line-maybe (line-from-uri parsed-uri no-path) lines))))

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
    (let ((newfrom (remove-line line from))
	  (newto (or (add-line-maybe line to) to)))
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

;;; MAIN PROCEDURES

(defvar *args*    ccl:*unprocessed-command-line-arguments*)
(defvar *default-lists* (list :saved :used :origins)
  "The default list of keyed names used in *data* to store
an associated filespec and lines from that file.")
(defvar *default-filespecs* (list ".saved" ".used" ".origins")
  "The default list of filespecs to be associated with the lists.  These values
can be replaced through an INIT command line argument.")
(defparameter *lists* *default-lists*)
(defparameter *filespecs* *default-filespecs*)
(defparameter *data*
  "The combined association lists of lists and filespecs and lines.")

(defun list-args ()
  "Used for debugging purposes only."
  (print (format t "The args are: ~s" *args*)))

(defun load-vars (lists specs data) ; => *data* := ((:key ("spec" (line line))))
  "Load the *vars* with lines. The returned data structure is of the
form ((:name 'filespec' (line line line))(...))"
  (if (null lists) data
      (let* ((a (car lists))
	     (b (car specs))
	     (c (get-lines b))
	     (newdata (cons a (cons (cons b (cons c ())) ()))))
	(load-vars (cdr lists) (cdr specs) (cons newdata data)))))

(defun data-payload (key) ; see *data* above
  (cadadr (assoc key *data*)))

(defun process-args (args)
  "Given a list of command line arguments, process each one in turn.
If the *data* has not yet been initialized, do that first."
  (unless (listp *data*)
    (let ((filespecs (member "init" *args* :test #'string=)))
      (when filespecs
	(setq *filespecs*
	      (subseq (cdr filespecs) 0 3))))
    (setq *data* (load-vars *lists* *filespecs* ()))
    (format t "Initialize process-args")(terpri)(terpri)
    (process-args args))
  (cond ((consp args)
	 (format t "...in process-args cond...")(terpri)
	 (let* ((arg (car args))
	        (num-arg (parse-integer arg :junk-allowed t))
		(uri-arg (quri:uri arg)))
	   (format t "the current arg is ~s..." arg)(terpri)
	   (when (numberp num-arg)
	     (format t "~d is an integer..." arg)(terpri))
	   (when (quri:uri-scheme uri-arg)
	     (format t "~s is a uri..." uri-arg)(terpri)))
	 (format t "Inside process-args")(terpri)
	 (process-args (cdr args)))
	(t (format t "All done.")(terpri))))

;; (format t "Outside process-args")(terpri)(terpri)
;; (process-args *args*)
;; (terpri)
;; (format t "The data payload for ~s is:
;;   ~s" :saved (data-payload :saved *data*))

;; (quit)

;;; //////////////////////////////////////////////////////////////////////////
;;; END CODE
