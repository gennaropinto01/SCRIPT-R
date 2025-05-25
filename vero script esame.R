setwd("/Users/gennaropinto/Desktop/Statistical For Finance/SSF progetto VERISSIMO")

librardir = library(readr) #lettura dati
library(corrplot) #visualizzazione matrice di correlazione
library(ggplot2) #migliore visualizzazione dei grafici
library(cowplot) #collegato a ggplot2, fornisce grafici migliori
library(lmtest) #test del modello di regressione lineare
library(car) #QQplot
library(sandwich) #analisi di regressione con stime robuste
library(GGally) #grafici più accurati
library(pscl) #per McFadden Rˆ2
library(caret) #ConfusionMatrix
library(ROCR)  #funzione di previsione per calcolare ROC e AUC
library(dplyr) #accorpare livelli variabili categoriche
library(readxl) #leggere i file excel
library(gridGraphics) #plot
library(ggrepel) #scritte sui grafici più ordinate
library(cluster) #ci serve per costruire l'indice di accostamento
library(rmarkdown)
library(ggplot2)
library(patchwork)

#STRUTTURA DEL DATASET
str(dataset_2)
head(dataset_2)
summary(dataset_2)
variable.names(dataset_2)
View(dataset_2)

#VALORI MANCANTI
dataset_2 <- read_xlsx("/Users/gennaropinto/Desktop/Statistical For Finance/SSF progetto VERISSIMO/dataset-2" ,na = c("", "NA", "null", "N/A")) 
cat(any(is.na(dataset_2)))
#ASSEGNO I VALORI ALLE VARIABILI
income=dataset_2$Income
creditscore=dataset_2$Credit_Score
loan=dataset_2$Loan_Amount
dti=dataset_2$DTI_Ratio
employment=dataset_2$`Employment (0/1)`
approval=dataset_2$`Approval (0/1)`

#DISTRUBUZIONI DI DENSITA'

#1 KERNEL
kernel.income=ggplot(dataset_2, aes(x=income)) + geom_density() +
  theme_gray(base_size = 10)

kernel.creditscore=ggplot(dataset_2, aes(x=creditscore)) + geom_density() +
  theme_gray(base_size = 10)

kernel.dti=ggplot(dataset_2, aes(x=dti)) + geom_density() + theme_gray(base_size=10)

kernel.loan=ggplot(dataset_2, aes(x=loan)) + geom_density() +
  theme_gray(base_size = 10)

plot_grid(kernel.income, kernel.creditscore,kernel.dti, kernel.loan, labels="AUTO", nrow = 3, ncol = 2)

#2 BOXPLOT
box.income=ggplot(dataset_2, aes(x = income)) + geom_boxplot() +
  theme_gray(base_size = 10)
box.creditscore=ggplot(dataset_2, aes(x = creditscore)) + geom_boxplot() +
  theme_gray(base_size = 10)
box.dti=ggplot(dataset_2, aes(x = dti)) + geom_boxplot() +
  theme_gray(base_size = 10)
box.loan=ggplot(dataset_2, aes(x = loan)) + geom_boxplot() +
  theme_gray(base_size = 10)

plot_grid(box.income, box.creditscore,box.dti, box.loan, labels="AUTO", nrow = 3, ncol = 2)

# Creo tutti i plot singoli
library(ggplot2)
library(patchwork)

p1 <- ggplot(dataset_2, aes(x = factor(employment))) +
  geom_bar(fill = "skyblue") +
  labs(title = "Employment", x = "Employment (0/1)", y = "Count")

p2 <- ggplot(dataset_2, aes(x = factor(approval))) +
  geom_bar(fill = "palegreen") +
  labs(title = "Approval", x = "Approval (0/1)", y = "Count")

p3 <- ggplot(dataset_2, aes(x = income)) +
  geom_histogram(fill = "lightcoral", bins = 30) +
  labs(title = "Income", x = "Income", y = "Frequency")

p4 <- ggplot(dataset_2, aes(x = creditscore))+
  geom_histogram(fill = "gold", bins = 30) +
  labs(title = "Credit Score", x = "Credit Score", y = "Frequency")

p5 <- ggplot(dataset_2, aes(x = loan)) +
  geom_histogram(fill = "lightseagreen", bins = 30) +
  labs(title = "Loan Amount", x = "Loan Amount", y = "Frequency")

p6 <- ggplot(dataset_2, aes(x = dti)) +
  geom_histogram(fill = "mediumpurple", bins = 30) +
  labs(title = "DTI Ratio", x = "DTI Ratio", y = "Frequency")

# Combino i plot in una griglia 2x3
(p1 | p2 | p3) / (p4 | p5 | p6)


#CORRELATION
cor(dataset_2)

ggpairs(as.data.frame(dataset_2))

corrplot(cor(dataset_2), method = "number", type = "lower")

# Logistic regression model
# Divisione in training e test set
set.seed(123)  # per riproducibilità
trainIndex <- createDataPartition(dataset_2$`Approval (0/1)`, p = 0.7, list = FALSE)
train_set <- dataset_2[trainIndex, ]
test_set <- dataset_2[-trainIndex, ]

# Modello logistico sul training set
model_logit <- glm(`Approval (0/1)` ~ Credit_Score + DTI_Ratio + Income + Loan_Amount + `Employment (0/1)`,
                   data = train_set, family = binomial)
summary(model_logit)

train_set <- train_set %>% select(-`Employment (0/1)`)
test_set <- test_set %>% select(-`Employment (0/1)`)
model_logit2 <- glm(`Approval (0/1)` ~ Credit_Score + DTI_Ratio + Income + Loan_Amount,
                    data = train_set, family = binomial)
summary(model_logit2)
#MCFADDEEN R2
mcfadden_r2 <- 1 - (model_logit2$deviance / model_logit2$null.deviance)
print(mcfadden_r2)

#VErifichiamo la multicollinearità
vif(model_logit2)

#ANALISI DEI RESIDUI REGRESSIONE LOGISTICA
fitted_values = model_logit2$fitted.values
residual = model_logit2$residuals
head(cbind(train_set[,-1], fitted_values, residual), 12)

# correzione notazione
plot(residual, ylab = "Residuals", xlab = "Approval", main = "Residual Plot", axes = FALSE)
axis(1)
axis(2, at = pretty(residual), labels = format(pretty(residual), scientific = FALSE),
     las = 1)
box()
#calcoliamo:
# i gradi di libertà
df=df.residual(model_logit2)
# varianza stimata
s.hat=t(residual)%*%residual/df
# errore standard residuo (RSE)
rse=sqrt(s.hat)
# residui standardizzati
sres=residual/rse
#Successivamente andiamo a plottare la diagnostica del nostro modello:
par(mfrow=c(2,2))
plot(model_logit2)

# utilizziamo la soglia come criterio per determinare quali osservazione del dataset
# hanno un'influenza significativa sui parametri stimati del modello di regressione
soglia <- 4 / (nrow(train_set) - length(model_logit2$coefficients) - 1)
# Calcolo della distanza di Cook
cookd <- cooks.distance(model_logit2)
# Identificazione degli outliers
outliers <- as.numeric(names(cookd)[cookd > soglia])
# Creazione di un indice per le osservazioni
index <- seq(1:length(model_logit2$residuals))
# Creazione del dataframe per il grafico
cookdf <- data.frame(cookd, index)
# Creazione del grafico con ggplot2
ggplot(cookdf, aes(x = index, y = cookd, color = cookd > soglia)) +
  geom_point() +
  scale_color_manual(values = c("black", "#F54D47")) +
  geom_hline(yintercept = soglia, linetype = "longdash", colour = "#1B68A6") +
  annotate("text", x = min(index) - 15, y = soglia + 0.0005,
           label = "soglia", colour = "#1B68A6", hjust = 0) +
  theme(legend.position = "none",
        plot.title = element_text(face = 'bold', hjust = 0.5)) +
  ggtitle("Cook's distance plot (influential points in red)") +
  labs(x = "Observation", y = "Cook's distance")

#Ora procediamo alla stima del modello dopo l’eliminazione dei punti influenti:
clean_data <- train_set[-outliers, ]
reg_clean3 <- glm((train_set$`Approval (0/1)`) ~ sqrt(train_set$Income) +
                    +                    sqrt(train_set$Credit_Score) + sqrt(train_set$Loan_Amount) +
                    +                    sqrt(train_set$DTI_Ratio),data=clean_data, family= binomial)
summary(reg_clean3)
summary(model_logit2)

# Previsioni sul test set
fitted.results <- predict(model_logit2, newdata = test_set, type = 'response')
fitted.class <- ifelse(fitted.results > 0.5, 1, 0)

# Calcolo accuracy
actual <- test_set$`Approval (0/1)`
misClasificError <- mean(fitted.class != actual)
print(paste('Accuracy:', 1 - misClasificError))

# Confusion matrix
confusionMatrix(factor(fitted.class), factor(actual), positive = "1")

# 1. Previsioni sul test set (già fatto prima)
fitted.results <- predict(model_logit2, newdata = test_set, type = 'response')
fitted.class <- ifelse(fitted.results > 0.5, 1, 0)

# 2. Calcolo della confusion matrix con caret
cm <- confusionMatrix(factor(fitted.class), factor(test_set$`Approval (0/1)`), positive = "1")

# 3. Funzione per disegnare la confusion matrix
draw_confusion_matrix <- function(cm) {
  layout(matrix(c(1,1,2)))
  par(mar=c(2,2,2,2))
  
  # Box della confusion matrix
  plot(c(100, 345), c(300, 450), type = "n", xlab="", ylab="", xaxt='n', yaxt='n')
  title('CONFUSION MATRIX', cex.main=2)
  
  # Riquadri Pred/Actual
  rect(150, 430, 240, 370, col="#1B68A6")  # Pred 0 / Actual 0
  text(195, 435, '0', cex=1.6)
  rect(250, 430, 340, 370, col="#F54D47")  # Pred 1 / Actual 0
  text(295, 435, '1', cex=1.6)
  
  text(125, 370, 'Predicted', cex=1.2, srt=90, font=1)
  text(245, 450, 'Actual', cex=1.2, font=1)
  
  rect(150, 305, 240, 365, col="#F54D47")  # Pred 0 / Actual 1
  rect(250, 305, 340, 365, col="#1B68A6")  # Pred 1 / Actual 1
  text(140, 400, '0', cex=1.6, srt=90)
  text(140, 335, '1', cex=1.6, srt=90)
  
  # Numeri della confusion matrix
  res <- as.numeric(cm$table)
  text(195, 400, res[1], cex=1.6, font=2, col='white')  # True Negatives
  text(195, 335, res[2], cex=1.6, font=2, col='white')  # False Negatives
  text(295, 400, res[3], cex=1.6, font=2, col='white')  # False Positives
  text(295, 335, res[4], cex=1.6, font=2, col='white')  # True Positives
  
  # Box delle metriche
  plot(c(100, 0), c(100, 0), type = "n", xlab="", ylab="", main = "DETAILS", xaxt='n', yaxt='n')
  text(80, 75, names(cm$overall)[1], cex=2, font=2)  # Accuracy
  text(80, 35, round(as.numeric(cm$overall[1]), 4), cex=2)
  
  text(50, 75, names(cm$byClass)[1], cex=2, font=2)  # Sensitivity
  text(50, 35, round(as.numeric(cm$byClass[1]), 4), cex=2)
  
  text(20, 75, names(cm$byClass)[2], cex=2, font=2)  # Specificity
  text(20, 35, round(as.numeric(cm$byClass[2]), 4), cex=2)
}

# 4. Disegna la matrice di confusione
draw_confusion_matrix(cm)

# 1. Previsioni sul test set
fitted.results <- predict(model_logit2, newdata = test_set, type = 'response')

# 2. Conversione in classi (soglia 0.5)
fitted.class <- ifelse(fitted.results > 0.5, 1, 0)

# 3. Calcolo del misclassification error
actual <- test_set$`Approval (0/1)`
misClasificError <- mean(fitted.class != actual)

# 4. Stampa dell'accuracy
print(paste('Accuracy:', 1 - misClasificError))

##aumentiamo la sensibilità del modello
probabilities <- predict(model_logit2, newdata = test_set, type = "response")
##Soglia personalizzata 
predicted_classes <- ifelse(probabilities > 0.3, 1, 0)
#Confusion matrix con la nuova soglia
cm <- confusionMatrix(factor(predicted_classes), factor(test_set$`Approval (0/1)`))
print(cm)




# Libreria ROCR
library(ROCR)

# 1. Previsioni di probabilità sul test set
p <- predict(model_logit2, newdata = test_set, type = 'response')

# 2. Oggetto prediction (probabilità vs. valori reali)
pr <- prediction(p, test_set$`Approval (0/1)`)

# 3. Calcolo AUC
auc <- performance(pr, measure = "auc")
auc_value <- auc@y.values[[1]]
print(paste("AUC:", round(auc_value, 4)))

# 4. ROC Curve
prf <- performance(pr, measure = "tpr", x.measure = "fpr")
plot(prf, col="#1B68A6", main="ROC Curve & AUC")
abline(0, 1, col="#F54D47", lty=2)  # Linea diagonale

print(paste0("AUC : ", round(auc_value, 4)))


# Analisi dell'effetto dei singoli predittori sulla probabilità di approvazione

# 1. Credit Score
credit_seq <- seq(min(test_set$Credit_Score), max(test_set$Credit_Score), length.out = 100)
newdata_credit <- data.frame(
  Credit_Score = credit_seq,
  DTI_Ratio = mean(test_set$DTI_Ratio, na.rm = TRUE),
  Income = mean(test_set$Income, na.rm = TRUE),
  Loan_Amount = mean(test_set$Loan_Amount, na.rm = TRUE)
)
newdata_credit$predicted_prob <- predict(model_logit2, newdata = newdata_credit, type = "response")

plot_credit <- ggplot(newdata_credit, aes(x = Credit_Score, y = predicted_prob)) +
  geom_line(color = "#1B68A6", size = 1.2) +
  labs(title = "Probabilità di Approvazione vs Credit Score", x = "Credit Score", y = "Prob Approval") +
  theme_minimal()

# 2. Loan Amount
loan_seq <- seq(min(test_set$Loan_Amount), max(test_set$Loan_Amount), length.out = 100)
newdata_loan <- data.frame(
  Loan_Amount = loan_seq,
  DTI_Ratio = mean(test_set$DTI_Ratio, na.rm = TRUE),
  Income = mean(test_set$Income, na.rm = TRUE),
  Credit_Score = mean(test_set$Credit_Score, na.rm = TRUE)
)
newdata_loan$predicted_prob <- predict(model_logit2, newdata = newdata_loan, type = "response")

plot_loan <- ggplot(newdata_loan, aes(x = Loan_Amount, y = predicted_prob)) +
  geom_line(color = "#1B68A6", size = 1.2) +
  labs(title = "Probabilità di Approvazione vs Loan Amount", x = "Loan Amount", y = "Prob Approval") +
  theme_minimal()

# 3. Income
income_seq <- seq(min(test_set$Income), max(train_set$Income), length.out = 100)
newdata_income <- data.frame(
  Loan_Amount = mean(test_set$Loan_Amount, na.rm = TRUE),
  DTI_Ratio = mean(test_set$DTI_Ratio, na.rm = TRUE),
  Income = income_seq,
  Credit_Score = mean(test_set$Credit_Score, na.rm = TRUE)
)
newdata_income$predicted_prob <- predict(model_logit2, newdata = newdata_income, type = "response")

plot_income <- ggplot(newdata_income, aes(x = Income, y = predicted_prob)) +
  geom_line(color = "#1B68A6", size = 1.2) +
  labs(title = "Probabilità di Approvazione vs Income", x = "Income", y = "Prob Approvazione") +
  theme_minimal()

# 4. DTI Ratio
dti_seq <- seq(min(test_set$DTI_Ratio), max(train_set$DTI_Ratio), length.out = 100)
newdata_dti <- data.frame(
  Loan_Amount = mean(test_set$Loan_Amount, na.rm = TRUE),
  DTI_Ratio = dti_seq,
  Income = mean(test_set$Income, na.rm = TRUE),
  Credit_Score = mean(test_set$Credit_Score, na.rm = TRUE)
)
newdata_dti$predicted_prob <- predict(model_logit2, newdata = newdata_dti, type = "response")

plot_dti <- ggplot(newdata_dti, aes(x = DTI_Ratio, y = predicted_prob)) +
  geom_line(color = "#1B68A6", size = 1.2) +
  labs(title = "Probabilità di Approvazione vs DTI Ratio", x = "DTI Ratio", y = "Prob Approvazione") +
  theme_minimal()


# Combina tutti e cinque i grafici
library(patchwork)
((plot_credit | plot_loan) / (plot_income | plot_dti)) 





