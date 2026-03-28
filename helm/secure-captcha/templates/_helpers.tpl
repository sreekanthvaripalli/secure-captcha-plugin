{{/*
Expand the name of the chart.
*/}}
{{- define "secure-captcha.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "secure-captcha.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "secure-captcha.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "secure-captcha.labels" -}}
helm.sh/chart: {{ include "secure-captcha.chart" . }}
{{ include "secure-captcha.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "secure-captcha.selectorLabels" -}}
app.kubernetes.io/name: {{ include "secure-captcha.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "secure-captcha.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "secure-captcha.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the configmap to use
*/}}
{{- define "secure-captcha.configMapName" -}}
{{- printf "%s-config" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the secret to use
*/}}
{{- define "secure-captcha.secretName" -}}
{{- printf "%s-secret" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the service to use
*/}}
{{- define "secure-captcha.serviceName" -}}
{{- printf "%s-service" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the ingress to use
*/}}
{{- define "secure-captcha.ingressName" -}}
{{- printf "%s-ingress" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the HPA to use
*/}}
{{- define "secure-captcha.hpaName" -}}
{{- printf "%s-hpa" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the PVC to use
*/}}
{{- define "secure-captcha.pvcName" -}}
{{- printf "%s-pvc" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the network policy to use
*/}}
{{- define "secure-captcha.networkPolicyName" -}}
{{- printf "%s-network-policy" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the role to use
*/}}
{{- define "secure-captcha.roleName" -}}
{{- printf "%s-role" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the role binding to use
*/}}
{{- define "secure-captcha.roleBindingName" -}}
{{- printf "%s-rolebinding" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the pod disruption budget to use
*/}}
{{- define "secure-captcha.pdbName" -}}
{{- printf "%s-pdb" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Create the name of the service monitor to use
*/}}
{{- define "secure-captcha.serviceMonitorName" -}}
{{- printf "%s-service-monitor" (include "secure-captcha.fullname" .) }}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "secure-captcha.image" -}}
{{- $registryName := .Values.app.image.registry -}}
{{- $repositoryName := .Values.app.image.repository -}}
{{- $tag := .Values.app.image.tag | toString -}}
{{- if .Values.global.imageRegistry }}
    {{- $registryName = .Values.global.imageRegistry -}}
{{- end -}}
{{- if $registryName }}
{{- printf "%s/%s:%s" $registryName $repositoryName $tag }}
{{- else }}
{{- printf "%s:%s" $repositoryName $tag }}
{{- end }}
{{- end }}

{{/*
Return the proper Docker Image Registry Secret Names
*/}}
{{- define "secure-captcha.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- else if .Values.app.image.pullSecrets }}
imagePullSecrets:
{{- range .Values.app.image.pullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Return the appropriate apiVersion for deployment.
*/}}
{{- define "secure-captcha.deployment.apiVersion" -}}
{{- print "apps/v1" -}}
{{- end }}

{{/*
Return the appropriate apiVersion for ingress.
*/}}
{{- define "secure-captcha.ingress.apiVersion" -}}
{{- if semverCompare ">=1.19-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "networking.k8s.io/v1" -}}
{{- else if semverCompare ">=1.14-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "networking.k8s.io/v1beta1" -}}
{{- else -}}
{{- print "extensions/v1beta1" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for HPA.
*/}}
{{- define "secure-captcha.hpa.apiVersion" -}}
{{- if semverCompare ">=1.23-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "autoscaling/v2" -}}
{{- else if semverCompare ">=1.12-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "autoscaling/v2beta2" -}}
{{- else -}}
{{- print "autoscaling/v2beta1" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for PDB.
*/}}
{{- define "secure-captcha.pdb.apiVersion" -}}
{{- if semverCompare ">=1.21-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "policy/v1" -}}
{{- else -}}
{{- print "policy/v1beta1" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for NetworkPolicy.
*/}}
{{- define "secure-captcha.networkPolicy.apiVersion" -}}
{{- if semverCompare ">=1.7-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "networking.k8s.io/v1" -}}
{{- else -}}
{{- print "extensions/v1beta1" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for RBAC.
*/}}
{{- define "secure-captcha.rbac.apiVersion" -}}
{{- print "rbac.authorization.k8s.io/v1" -}}
{{- end }}

{{/*
Return the appropriate apiVersion for ServiceMonitor.
*/}}
{{- define "secure-captcha.serviceMonitor.apiVersion" -}}
{{- print "monitoring.coreos.com/v1" -}}
{{- end }}

{{/*
Compile all warnings into a call outside of the template scope to avoid template scope issues.
*/}}
{{- define "secure-captcha.validateValues" -}}
{{- $messages := list -}}
{{- $messages := append $messages (include "secure-captcha.validateValues.foo" .) -}}
{{- $messages := append $messages (include "secure-captcha.validateValues.bar" .) -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}
{{- if $message -}}
{{-   printf "\nVALUES VALIDATION:\n%s" $message | fail -}}
{{- end -}}
{{- end -}}

{{/*
Validate values of Secure CAPTCHA - Foo
*/}}
{{- define "secure-captcha.validateValues.foo" -}}
{{- if .Values.foo -}}
{{- if not .Values.foo.bar -}}
secure-captcha: foo
    You must set foo.bar
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Validate values of Secure CAPTCHA - Bar
*/}}
{{- define "secure-captcha.validateValues.bar" -}}
{{- if .Values.bar -}}
{{- if not .Values.bar.foo -}}
secure-captcha: bar
    You must set bar.foo
{{- end -}}
{{- end -}}
{{- end -}}